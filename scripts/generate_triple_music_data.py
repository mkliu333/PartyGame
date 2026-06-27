from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}
OFFICE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REQUIRED_HEADERS = ("ID", "Category", "Answer", "Music")


def column_index(reference: str) -> int:
    letters = re.match(r"[A-Z]+", reference).group(0)
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - ord("A") + 1
    return value - 1


def read_workbook_rows(path: Path) -> list[list[str]]:
    with zipfile.ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("x:si", NS):
                shared_strings.append("".join(node.text or "" for node in item.iterfind(".//x:t", NS)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        first_sheet = workbook.find("x:sheets/x:sheet", NS)
        if first_sheet is None:
            return []
        relationship_id = first_sheet.attrib[f"{{{OFFICE_REL}}}id"]
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        target = next(
            rel.attrib["Target"]
            for rel in relationships.findall("r:Relationship", REL_NS)
            if rel.attrib["Id"] == relationship_id
        )
        sheet_path = "xl/" + target.lstrip("/")
        sheet = ET.fromstring(archive.read(sheet_path))

        rows: list[list[str]] = []
        for row in sheet.findall(".//x:sheetData/x:row", NS):
            values: dict[int, str] = {}
            for cell in row.findall("x:c", NS):
                index = column_index(cell.attrib["r"])
                cell_type = cell.attrib.get("t")
                if cell_type == "inlineStr":
                    value = "".join(node.text or "" for node in cell.iterfind(".//x:t", NS))
                else:
                    raw = cell.findtext("x:v", default="", namespaces=NS)
                    value = shared_strings[int(raw)] if cell_type == "s" and raw else raw
                values[index] = value
            if values:
                rows.append([values.get(index, "") for index in range(max(values) + 1)])
        return rows


def normalize_rows(rows: list[list[str]], project_root: Path) -> tuple[list[dict[str, str]], list[str], list[str]]:
    if not rows:
        raise ValueError("Workbook contains no rows")
    headers = [str(value).strip() for value in rows[0]]
    missing = [header for header in REQUIRED_HEADERS if header not in headers]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")
    indexes = {header: headers.index(header) for header in REQUIRED_HEADERS}
    tracks: list[dict[str, str]] = []
    issues: list[str] = []
    corrections: list[str] = []
    seen_ids: set[str] = set()
    seen_numbers: dict[str, str] = {}

    for row_number, row in enumerate(rows[1:], start=2):
        values = {
            header: (str(row[index]).strip() if index < len(row) else "")
            for header, index in indexes.items()
        }
        if not any(values.values()):
            continue
        track_id = values["ID"].lower()
        category = values["Category"]
        answer = values["Answer"]
        music = values["Music"].replace("\\", "/")
        missing_fields = [name for name, value in (("ID", track_id), ("Category", category), ("Answer", answer), ("Music", music)) if not value]
        if missing_fields:
            issues.append(f"Row {row_number}: missing {', '.join(missing_fields)}; skipped")
            continue
        if track_id in seen_ids:
            issues.append(f"Row {row_number}: duplicate ID {track_id}; skipped")
            continue
        id_match = re.fullmatch(r"tt?(\d+)", track_id)
        if not id_match:
            issues.append(f"Row {row_number}: invalid ID {track_id}; skipped")
            continue
        number = id_match.group(1)
        if number in seen_numbers:
            issues.append(f"Row {row_number}: numeric collision {seen_numbers[number]} / {track_id}; skipped")
            continue
        if not music.startswith("assets/triple_music/"):
            issues.append(f"Row {row_number}: invalid music prefix for {track_id}; skipped")
            continue
        if not music.lower().endswith(".mp3"):
            issues.append(f"Row {row_number}: non-MP3 music for {track_id}; skipped")
            continue
        if not (project_root / Path(music)).is_file():
            matching_assets = list((project_root / "assets" / "triple_music").glob(f"{track_id}_*.mp3"))
            if len(matching_assets) == 1:
                corrected_music = matching_assets[0].relative_to(project_root).as_posix()
                corrections.append(f"Row {row_number}: corrected {music} -> {corrected_music}")
                music = corrected_music
        seen_ids.add(track_id)
        seen_numbers[number] = track_id
        tracks.append({"id": track_id, "category": category, "answer": answer, "music": music})
    return tracks, issues, corrections


def write_javascript(path: Path, tracks: list[dict[str, str]]) -> None:
    lines = ["// Generated from triple_music_questions.xlsx. Keep UTF-8 encoding.", "window.PARTY_TRIPLE_MUSIC_TRACKS = ["]
    for index, track in enumerate(tracks):
        suffix = "," if index < len(tracks) - 1 else ""
        lines.extend([
            "  {",
            f"    id: {json.dumps(track['id'], ensure_ascii=False)},",
            f"    category: {json.dumps(track['category'], ensure_ascii=False)},",
            f"    answer: {json.dumps(track['answer'], ensure_ascii=False)},",
            f"    music: {json.dumps(track['music'], ensure_ascii=False)}",
            f"  }}{suffix}",
        ])
    lines.append("];")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    source = Path(sys.argv[1])
    destination = Path(sys.argv[2])
    tracks, issues, corrections = normalize_rows(read_workbook_rows(source), source.resolve().parents[2])
    write_javascript(destination, tracks)
    categories: dict[str, int] = {}
    for track in tracks:
        categories[track["category"]] = categories.get(track["category"], 0) + 1
    print(json.dumps({"written": len(tracks), "categories": categories, "skipped": len(issues), "issues": issues, "corrections": corrections}, ensure_ascii=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
