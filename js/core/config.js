window.PartyGame = window.PartyGame || {};
window.PartyGame.Config = window.PartyGame.Config || {};

    const APP_VERSION = "v4.2.8-hotfix-1";

    const UPDATE_THEME = "修复音乐新增曲目的真实歌手识别";

    const CATEGORY_CONFIG = [
      { id: "movie", label: "电影" },
      { id: "tv", label: "电视剧" },
      { id: "variety", label: "综艺" },
      { id: "meme", label: "网络热梗" }
    ];

    const ROUND_SIZE_OPTIONS = [5, 10, 20, 30, 40, 50, "ALL"];

    const UI_THEME_OPTIONS = [
      { id: "classic_cream", label: "经典奶油", icon: "🎂", decor: ["🎈", "🍬", "⭐", "🎁", "🍭", "✨"] },
      { id: "strawberry_pop", label: "草莓波普", icon: "🍓", decor: ["🍓", "💗", "🍒", "🎀", "✨", "🧃"] },
      { id: "mint_soda", label: "薄荷气泡", icon: "🫧", decor: ["🫧", "🍋", "🌿", "💧", "🧊", "✨"] },
      { id: "starry_neon", label: "星空霓虹", icon: "🌌", decor: ["🌟", "🌙", "🪐", "💫", "✨", "🌌"] },
      { id: "retro_arcade", label: "复古街机", icon: "🕹️", decor: ["🕹️", "👾", "⚡", "💿", "🏆", "🎮"] }
    ];

    const AVATAR_LIBRARY = [
      { id: "strawberry", label: "草莓", emoji: "🍓", color: "#ffd8df" },
      { id: "peach", label: "蜜桃", emoji: "🍑", color: "#ffc09b" },
      { id: "lemon", label: "柠檬", emoji: "🍋", color: "#ffe58d" },
      { id: "candy", label: "糖果", emoji: "🍬", color: "#cfc2ff" },
      { id: "cupcake", label: "纸杯蛋糕", emoji: "🧁", color: "#aee8cc" },
      { id: "dango", label: "团子", emoji: "🍡", color: "#a9dcff" },
      { id: "lollipop", label: "棒棒糖", emoji: "🍭", color: "#ffe1ec" },
      { id: "star", label: "星星", emoji: "🌟", color: "#fff1b5" },
      { id: "cherry", label: "樱桃", emoji: "🍒", color: "#ffc2d1" },
      { id: "grape", label: "葡萄", emoji: "🍇", color: "#d9ccff" },
      { id: "watermelon", label: "西瓜", emoji: "🍉", color: "#baf0cf" },
      { id: "cookie", label: "饼干", emoji: "🍪", color: "#ffd6a8" },
      { id: "donut", label: "甜甜圈", emoji: "🍩", color: "#ffc7df" },
      { id: "icecream", label: "冰淇淋", emoji: "🍦", color: "#d8f2ff" },
      { id: "balloon", label: "气球", emoji: "🎈", color: "#ffd1d1" },
      { id: "gift", label: "礼物", emoji: "🎁", color: "#d5f6e7" },
      { id: "party", label: "派对", emoji: "🥳", color: "#ffe6a6" },
      { id: "cake", label: "蛋糕", emoji: "🎂", color: "#eadcff" }
    ];

Object.assign(window.PartyGame.Config, { APP_VERSION, UPDATE_THEME, CATEGORY_CONFIG, ROUND_SIZE_OPTIONS, UI_THEME_OPTIONS, AVATAR_LIBRARY });

