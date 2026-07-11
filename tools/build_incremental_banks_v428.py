import json
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_V4 = ROOT / "data/script_guess/questions_v4.js"
SCRIPT_NEW = ROOT / "data/script_guess/questions_new.xlsx"
SCRIPT_V5 = ROOT / "data/script_guess/questions_v5.js"
MUSIC_V6 = ROOT / "data/triple_music/triple_music_questions_v6.js"
MUSIC_NEW = ROOT / "data/triple_music/triple_music_questions_new.xlsx"
MUSIC_V7 = ROOT / "data/triple_music/triple_music_questions_v7.js"
MUSIC_COMMON = ROOT / "js/games/music_common.js"

SCRIPT_CATEGORY_MAP = {
    "电影": "movie",
    "movie": "movie",
    "电视剧": "tv",
    "电视": "tv",
    "剧集": "tv",
    "tv": "tv",
    "综艺": "variety",
    "variety": "variety",
    "网络热梗": "meme",
    "热梗": "meme",
    "meme": "meme",
}

SCRIPT_HEADERS = {
    "id": ["id", "编号"],
    "type": ["type", "类型"],
    "category": ["category", "category_cn", "分类"],
    "source": ["source", "作品", "出处", "片名", "剧名", "节目"],
    "answer": ["answer", "答案", "台词"],
    "image": ["image", "image_path", "图片", "图"],
    "prompt_clip": ["prompt_clip", "prompt", "prompt_video", "题目视频", "提示视频"],
    "answer_clip": ["answer_clip", "answer_video", "答案视频"],
}

MUSIC_HEADERS = {
    "id": ["id", "编号"],
    "category": ["category", "分类"],
    "artist": ["artist", "singer", "歌手"],
    "answer": ["answer", "song", "歌曲", "歌名", "曲名", "歌曲名"],
    "music": ["music", "filename", "file", "path", "音频", "文件名", "文件"],
    "segment_type": ["segment_type", "type", "唱歌版/间奏版", "版本", "音频类型"],
}


def cell_text(value):
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def normalize_header(value):
    return re.sub(r"\s+", "", cell_text(value).lower())


def col_to_index(ref):
    letters = re.sub(r"[^A-Z]", "", ref.upper())
    index = 0
    for char in letters:
        index = index * 26 + ord(char) - ord("A") + 1
    return index - 1


def read_xlsx(path):
    ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with zipfile.ZipFile(path) as archive:
        shared_strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for si in root.findall("a:si", ns):
                shared_strings.append("".join(t.text or "" for t in si.findall(".//a:t", ns)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        rel_targets = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall("rel:Relationship", ns)
        }
        sheets = []
        for sheet in workbook.findall(".//a:sheet", ns):
            name = sheet.attrib["name"]
            rid = sheet.attrib[f"{{{ns['r']}}}id"]
            target = rel_targets[rid].lstrip("/")
            sheet_path = target if target.startswith("xl/") else f"xl/{target}"
            sheet_root = ET.fromstring(archive.read(sheet_path))
            rows = []
            for row in sheet_root.findall(".//a:sheetData/a:row", ns):
                values = []
                for cell in row.findall("a:c", ns):
                    idx = col_to_index(cell.attrib.get("r", "A1"))
                    while len(values) <= idx:
                        values.append("")
                    cell_type = cell.attrib.get("t")
                    if cell_type == "inlineStr":
                        value = "".join(t.text or "" for t in cell.findall(".//a:t", ns))
                    else:
                        raw = cell.find("a:v", ns)
                        value = raw.text if raw is not None else ""
                        if cell_type == "s" and value != "":
                            value = shared_strings[int(value)]
                    values[idx] = cell_text(value)
                if any(values):
                    rows.append(values)
            sheets.append({"name": name, "rows": rows})
        return sheets


def header_map(headers, aliases):
    normalized = [normalize_header(header) for header in headers]
    result = {}
    for field, names in aliases.items():
        keys = [normalize_header(name) for name in names]
        for index, header in enumerate(normalized):
            if header in keys:
                result[field] = index
                break
    return result


def get_field(row, mapping, field):
    index = mapping.get(field)
    if index is None or index >= len(row):
        return ""
    return cell_text(row[index])


def load_script_questions(path):
    text = path.read_text(encoding="utf-8-sig")
    match = re.search(r"window\.PARTY_QUESTIONS\s*=\s*(\[.*\])\s*;\s*$", text, re.S)
    if not match:
        raise ValueError(f"Cannot find PARTY_QUESTIONS in {path}")
    return json.loads(match.group(1))


def load_music_tracks(path):
    text = path.read_text(encoding="utf-8-sig")
    body = re.search(r"window\.PARTY_TRIPLE_MUSIC_TRACKS\s*=\s*\[(.*)\]\s*;\s*$", text, re.S)
    if not body:
        raise ValueError(f"Cannot find PARTY_TRIPLE_MUSIC_TRACKS in {path}")
    tracks = []
    for item in re.finditer(r"\{(.*?)\}", body.group(1), re.S):
        fields = {}
        for key in ["id", "category", "answer", "music"]:
            match = re.search(rf"\b{key}\s*:\s*\"((?:\\.|[^\"])*)\"", item.group(1))
            if not match:
                raise ValueError(f"Missing {key} in music item: {item.group(0)[:120]}")
            fields[key] = json.loads(f"\"{match.group(1)}\"")
        tracks.append(fields)
    return tracks


def normalize_asset_path(value, prefix, suffixes):
    value = cell_text(value).replace("\\", "/")
    if not value:
        return ""
    value = re.sub(r"^[A-Za-z]:/+", "", value)
    value = value.lstrip("./")
    if value.startswith(prefix):
        return value
    if "/" not in value and any(value.lower().endswith(suffix) for suffix in suffixes):
        return f"{prefix}{value}"
    return value


def script_duplicate_key(question):
    return "|".join(cell_text(question.get(field)) for field in [
        "source",
        "answer",
        "prompt_clip",
        "answer_clip",
        "image",
    ])


def next_question_number(questions):
    numbers = []
    for question in questions:
        match = re.fullmatch(r"q(\d+)", cell_text(question.get("id")))
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def build_script_bank():
    questions = load_script_questions(SCRIPT_V4)
    sheets = read_xlsx(SCRIPT_NEW)
    rows = []
    sheet_descriptions = []
    for sheet in sheets:
        if not sheet["rows"]:
            continue
        mapping = header_map(sheet["rows"][0], SCRIPT_HEADERS)
        sheet_descriptions.append((sheet["name"], sheet["rows"][0], mapping))
        for offset, row in enumerate(sheet["rows"][1:], start=2):
            if any(row):
                rows.append((sheet["name"], offset, row, mapping))

    existing_ids = {question["id"] for question in questions}
    existing_keys = {script_duplicate_key(question) for question in questions}
    next_number = next_question_number(questions)
    added = []
    warnings = []
    skipped_duplicates = 0
    missing_required = 0
    missing_assets = []

    for sheet_name, row_number, row, mapping in rows:
        category_raw = get_field(row, mapping, "category")
        category = SCRIPT_CATEGORY_MAP.get(category_raw.strip().lower(), SCRIPT_CATEGORY_MAP.get(category_raw.strip(), ""))
        source = get_field(row, mapping, "source")
        answer = get_field(row, mapping, "answer")
        image = normalize_asset_path(get_field(row, mapping, "image"), "assets/script_guess/images/", [".jpg", ".jpeg", ".png", ".webp", ".gif"])
        prompt_clip = normalize_asset_path(get_field(row, mapping, "prompt_clip"), "assets/script_guess/clips/", [".mp4", ".webm", ".mov"])
        answer_clip = normalize_asset_path(get_field(row, mapping, "answer_clip"), "assets/script_guess/clips/", [".mp4", ".webm", ".mov"])
        qtype = get_field(row, mapping, "type")
        if not qtype:
            if image and not prompt_clip:
                qtype = "image_line"
            elif prompt_clip:
                qtype = "next_line"
        if qtype not in {"next_line", "image_line"}:
            warnings.append(f"Script warning: row {row_number} sheet {sheet_name} has invalid type {qtype!r}; skipped")
            missing_required += 1
            continue
        if not category:
            warnings.append(f"Script warning: row {row_number} sheet {sheet_name} has unknown category {category_raw!r}; skipped")
            missing_required += 1
            continue
        if not source or not answer or not (image or prompt_clip):
            warnings.append(f"Script warning: row {row_number} sheet {sheet_name} missing required fields; skipped")
            missing_required += 1
            continue
        if not answer_clip:
            warnings.append(f"Script warning: row {row_number} sheet {sheet_name} missing answer_clip")

        question = {
            "id": f"q{next_number:03d}",
            "type": qtype,
            "category": category,
            "source": source,
            "answer": answer,
            "image": image,
            "prompt_clip": prompt_clip,
            "answer_clip": answer_clip,
        }
        key = script_duplicate_key(question)
        if key in existing_keys:
            warnings.append(f"Script warning: row {row_number} sheet {sheet_name} duplicate question skipped: {source} / {answer}")
            skipped_duplicates += 1
            continue
        while question["id"] in existing_ids:
            next_number += 1
            question["id"] = f"q{next_number:03d}"
        for path in [image, prompt_clip, answer_clip]:
            if path and not (ROOT / path).exists():
                missing_assets.append(f"Missing script asset: row {row_number} / id {question['id']} / {source} / {answer} -> {path}")
        questions.append(question)
        added.append(question)
        existing_ids.add(question["id"])
        existing_keys.add(key)
        next_number += 1

    output = "// PartyGame question bank v5. Generated from questions_v4.js + questions_new.xlsx.\n"
    output += "window.PARTY_QUESTIONS = "
    output += json.dumps(questions, ensure_ascii=False, indent=2)
    output += ";\n"
    SCRIPT_V5.write_text(output, encoding="utf-8-sig", newline="\r\n")
    return {
        "existing": len(questions) - len(added),
        "rows": len(rows),
        "added": len(added),
        "skipped_duplicates": skipped_duplicates,
        "missing_required": missing_required,
        "missing_assets": missing_assets,
        "category_counts": Counter(question["category"] for question in questions),
        "sheets": sheet_descriptions,
    }, warnings


def parse_music_common():
    text = MUSIC_COMMON.read_text(encoding="utf-8-sig")
    labels_block = re.search(r"const MUSIC_ARTIST_SLUG_LABELS\s*=\s*(\{.*?\});", text, re.S).group(1)
    pairs = re.findall(r"\"([^\"]+)\"\s*:\s*\"([^\"]+)\"", labels_block)
    labels = dict(pairs)
    threshold_match = re.search(r"const MUSIC_STANDALONE_ARTIST_THRESHOLD\s*=\s*(\d+)", text)
    threshold = int(threshold_match.group(1)) if threshold_match else 18
    misc_match = re.search(r"const MUSIC_MISC_CATEGORY_ID\s*=\s*\"([^\"]+)\"", text)
    misc = misc_match.group(1) if misc_match else "华语乐坛"
    return labels, threshold, misc


def music_number(track_id):
    match = re.fullmatch(r"tt?(\d+)", cell_text(track_id))
    return int(match.group(1)) if match else None


def music_prefix_from_path(path, segment_type=""):
    filename = Path(path).name.lower()
    if re.match(r"tt\d+", filename):
        return "tt"
    if re.match(r"t\d+", filename):
        return "t"
    value = segment_type.strip().lower()
    if value in {"instrumental", "intro", "bgm", "伴奏", "间奏", "间奏版"}:
        return "tt"
    if value in {"vocal", "sing", "唱歌", "唱歌版"}:
        return "t"
    return ""


def infer_artist_from_music(path, slug_labels):
    filename = Path(path).name.lower()
    stem = re.sub(r"\.mp3$", "", filename)
    stem = re.sub(r"^tt?\d+_?", "", stem)
    for slug in sorted(slug_labels, key=len, reverse=True):
        if stem == slug or stem.startswith(f"{slug}_"):
            return slug_labels[slug]
    return ""


def normalize_music_path(value):
    value = cell_text(value).replace("\\", "/")
    if not value:
        return ""
    value = re.sub(r"^[A-Za-z]:/+", "", value).lstrip("./")
    if value.startswith("assets/triple_music/"):
        return value
    if "/" not in value:
        return f"assets/triple_music/{value}"
    return value


def repair_existing_music_paths(tracks):
    repaired = []
    seen_music = set()
    for track in tracks:
        music = track["music"]
        basename = Path(music).name
        match = re.match(r"^(tt?\d+)(_.+\.mp3)$", basename, re.I)
        if music in seen_music and match and match.group(1) != track["id"]:
            candidate = f"assets/triple_music/{track['id']}{match.group(2)}"
            if (ROOT / candidate).exists():
                repaired.append((track["id"], music, candidate))
                track["music"] = candidate
                music = candidate
        seen_music.add(music)
    return repaired


def build_music_bank():
    slug_labels, threshold, misc_category = parse_music_common()
    tracks = load_music_tracks(MUSIC_V6)
    repaired_existing_paths = repair_existing_music_paths(tracks)
    sheets = read_xlsx(MUSIC_NEW)
    rows = []
    sheet_descriptions = []
    for sheet in sheets:
        if not sheet["rows"]:
            continue
        mapping = header_map(sheet["rows"][0], MUSIC_HEADERS)
        sheet_descriptions.append((sheet["name"], sheet["rows"][0], mapping))
        for offset, row in enumerate(sheet["rows"][1:], start=2):
            if any(row):
                rows.append((sheet["name"], offset, row, mapping))

    used_ids = {track["id"] for track in tracks}
    used_numbers = {music_number(track["id"]) for track in tracks}
    used_numbers.discard(None)
    used_music = {track["music"] for track in tracks}
    next_number = max(used_numbers, default=0) + 1
    added = []
    warnings = []
    missing_assets = []
    skipped_duplicates = 0
    missing_required = 0
    duplicate_ids = []
    duplicate_numbers = []
    new_artist_by_music = {}

    for sheet_name, row_number, row, mapping in rows:
        answer = get_field(row, mapping, "answer")
        music = normalize_music_path(get_field(row, mapping, "music"))
        artist = get_field(row, mapping, "artist")
        segment_type = get_field(row, mapping, "segment_type")
        raw_id = get_field(row, mapping, "id")
        if not answer or not music:
            warnings.append(f"Music warning: row {row_number} sheet {sheet_name} missing answer/music; skipped")
            missing_required += 1
            continue
        if not music.startswith("assets/triple_music/") or not music.lower().endswith(".mp3") or re.match(r"^[A-Za-z]:", music) or music.startswith("/"):
            warnings.append(f"Music warning: row {row_number} sheet {sheet_name} invalid music path {music!r}; skipped")
            missing_required += 1
            continue
        if music in used_music:
            warnings.append(f"Music warning: row {row_number} sheet {sheet_name} duplicate music skipped: {music}")
            skipped_duplicates += 1
            continue

        prefix = music_prefix_from_path(music, segment_type)
        track_id = ""
        raw_number = music_number(raw_id)
        if re.fullmatch(r"tt?\d+", raw_id) and raw_id not in used_ids and raw_number not in used_numbers:
            track_id = raw_id
            prefix = "tt" if raw_id.startswith("tt") else "t"
        else:
            if raw_id:
                duplicate_ids.append(raw_id)
            if not prefix:
                warnings.append(f"Music warning: row {row_number} sheet {sheet_name} cannot infer t/tt id prefix; skipped")
                missing_required += 1
                continue
            while next_number in used_numbers:
                next_number += 1
            track_id = f"{prefix}{next_number:03d}"
        number = music_number(track_id)
        if track_id in used_ids:
            duplicate_ids.append(track_id)
            warnings.append(f"Music warning: row {row_number} generated duplicate id {track_id}; skipped")
            skipped_duplicates += 1
            continue
        if number in used_numbers:
            duplicate_numbers.append(track_id)
            warnings.append(f"Music warning: row {row_number} generated duplicate numeric id {track_id}; skipped")
            skipped_duplicates += 1
            continue

        track = {
            "id": track_id,
            "category": get_field(row, mapping, "category") or misc_category,
            "answer": answer,
            "music": music,
        }
        tracks.append(track)
        added.append(track)
        if artist:
            new_artist_by_music[music] = artist
        used_ids.add(track_id)
        used_numbers.add(number)
        used_music.add(music)
        next_number = max(next_number, number + 1)
        if not (ROOT / music).exists():
            missing_assets.append(f"Missing music asset: row {row_number} / id {track_id} / {answer} -> {music}")

    artist_by_track = {}
    unknown_artist_tracks = []
    for track in tracks:
        artist = new_artist_by_music.get(track["music"], "")
        if not artist and track["category"] != misc_category:
            artist = track["category"]
        if not artist:
            artist = infer_artist_from_music(track["music"], slug_labels)
        if not artist:
            unknown_artist_tracks.append(track)
        artist_by_track[id(track)] = artist

    answers_by_artist = defaultdict(set)
    for track in tracks:
        artist = artist_by_track[id(track)]
        if artist:
            answers_by_artist[artist].add(track["answer"])

    standalone_artists = {
        artist for artist, answers in answers_by_artist.items()
        if len(answers) >= threshold
    }
    for track in tracks:
        artist = artist_by_track[id(track)]
        track["category"] = artist if artist in standalone_artists else misc_category

    ids = [track["id"] for track in tracks]
    nums = [music_number(track["id"]) for track in tracks]
    musics = [track["music"] for track in tracks]
    id_dups = [item for item, count in Counter(ids).items() if count > 1]
    num_dups = [item for item, count in Counter(nums).items() if item is not None and count > 1]
    music_dups = [item for item, count in Counter(musics).items() if count > 1]
    if id_dups:
        warnings.append(f"Music warning: duplicate ids in output: {id_dups}")
    if num_dups:
        warnings.append(f"Music warning: duplicate numeric ids in output: {num_dups}")
    if music_dups:
        warnings.append(f"Music warning: duplicate music paths in output: {music_dups}")
    for track in unknown_artist_tracks[:20]:
        warnings.append(f"Music warning: unable to infer real artist for {track['id']} / {track['answer']} / {track['music']}")

    lines = ["// PartyGame music bank v7. Generated from triple_music_questions_v6.js + triple_music_questions_new.xlsx.",
             "window.PARTY_TRIPLE_MUSIC_TRACKS = ["]
    for index, track in enumerate(tracks):
        comma = "," if index < len(tracks) - 1 else ""
        lines.extend([
            "  {",
            f"    id: {json.dumps(track['id'], ensure_ascii=False)},",
            f"    category: {json.dumps(track['category'], ensure_ascii=False)},",
            f"    answer: {json.dumps(track['answer'], ensure_ascii=False)},",
            f"    music: {json.dumps(track['music'], ensure_ascii=False)}",
            f"  }}{comma}",
        ])
    lines.append("];")
    MUSIC_V7.write_text("\n".join(lines) + "\n", encoding="utf-8-sig", newline="\r\n")
    return {
        "existing": len(tracks) - len(added),
        "rows": len(rows),
        "added": len(added),
        "skipped_duplicates": skipped_duplicates,
        "missing_required": missing_required,
        "missing_assets": missing_assets,
        "category_counts": Counter(track["category"] for track in tracks),
        "threshold": threshold,
        "standalone_artists": sorted(standalone_artists),
        "huayu_tracks": sum(1 for track in tracks if track["category"] == misc_category),
        "duplicate_ids": duplicate_ids,
        "duplicate_numbers": duplicate_numbers,
        "repaired_existing_paths": repaired_existing_paths,
        "sheets": sheet_descriptions,
    }, warnings


def print_sheet_info(title, sheets):
    print(title)
    for name, headers, mapping in sheets:
        print(f"- {name}: {headers}")
        print(f"  mapped: {mapping}")


def main():
    script_summary, script_warnings = build_script_bank()
    music_summary, music_warnings = build_music_bank()

    print_sheet_info("Script Guess Excel sheets:", script_summary["sheets"])
    print("Script Guess v5 summary:")
    print(f"- Existing v4 questions: {script_summary['existing']}")
    print(f"- New Excel rows: {script_summary['rows']}")
    print(f"- Added: {script_summary['added']}")
    print(f"- Skipped duplicates: {script_summary['skipped_duplicates']}")
    print(f"- Missing required fields: {script_summary['missing_required']}")
    print(f"- Missing assets: {len(script_summary['missing_assets'])}")
    print(f"- Category counts: {dict(script_summary['category_counts'])}")
    print(f"- Output: {SCRIPT_V5.relative_to(ROOT)}")
    for warning in script_warnings + script_summary["missing_assets"][:30]:
        print(warning)

    print()
    print_sheet_info("Triple Music Excel sheets:", music_summary["sheets"])
    print("Triple Music v7 summary:")
    print(f"- Existing v6 tracks: {music_summary['existing']}")
    print(f"- New Excel rows: {music_summary['rows']}")
    print(f"- Added: {music_summary['added']}")
    print(f"- Skipped duplicates: {music_summary['skipped_duplicates']}")
    print(f"- Missing required fields: {music_summary['missing_required']}")
    print(f"- Missing assets: {len(music_summary['missing_assets'])}")
    print(f"- Category counts: {dict(music_summary['category_counts'])}")
    print(f"- Standalone artist threshold: {music_summary['threshold']}")
    print(f"- Standalone artists: {music_summary['standalone_artists']}")
    print(f"- HuaYu tracks: {music_summary['huayu_tracks']}")
    print(f"- Duplicate IDs: {music_summary['duplicate_ids']}")
    print(f"- Duplicate numeric IDs: {music_summary['duplicate_numbers']}")
    print(f"- Repaired existing paths in v7: {music_summary['repaired_existing_paths']}")
    print(f"- Output: {MUSIC_V7.relative_to(ROOT)}")
    for warning in music_warnings + music_summary["missing_assets"][:30]:
        print(warning)

    if len(script_summary["missing_assets"]) > 20 or len(music_summary["missing_assets"]) > 20:
        raise SystemExit("Too many missing assets; refusing to continue.")
    if script_summary["missing_required"] or music_summary["missing_required"]:
        raise SystemExit("Missing required fields found; refusing to continue.")


if __name__ == "__main__":
    main()
