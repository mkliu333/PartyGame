window.PartyGame = window.PartyGame || {};
window.PartyGame.Data = window.PartyGame.Data || {};

function createBuiltInFallbackQuestions() {
  return [
    {
      id: "q001",
      type: "next_line",
      category: "movie",
      source: "西虹市首富",
      answer: "不装了，我是亿万富翁，我摊牌了",
      image: "",
      prompt_clip: "assets/script_guess/clips/q001_xi-hong-shi-shou-fu_prompt.mp4",
      answer_clip: "assets/script_guess/clips/q001_xi-hong-shi-shou-fu_answer.mp4"
    },
    {
      id: "q006",
      type: "next_line",
      category: "movie",
      source: "哪吒之魔童降世",
      answer: "是魔是仙，我自己说了才算",
      image: "",
      prompt_clip: "assets/script_guess/clips/q006_ne-zha_prompt.mp4",
      answer_clip: "assets/script_guess/clips/q006_ne-zha_answer.mp4"
    },
    {
      id: "q046",
      type: "next_line",
      category: "tv",
      source: "狂飙",
      answer: "京海那么多年，我花了这么多钱，养肥了这么多人",
      image: "",
      prompt_clip: "assets/script_guess/clips/q046_kuang-biao_prompt.mp4",
      answer_clip: "assets/script_guess/clips/q046_kuang-biao_answer.mp4"
    },
    {
      id: "q051",
      type: "next_line",
      category: "variety",
      source: "喜剧之王单口季",
      answer: "我是灵长类",
      image: "",
      prompt_clip: "assets/script_guess/clips/q051_tuo-kou-xiu_prompt.mp4",
      answer_clip: "assets/script_guess/clips/q051_tuo-kou-xiu_answer.mp4"
    }
  ];
}

const BUILT_IN_QUESTIONS = createBuiltInFallbackQuestions();

Object.assign(window.PartyGame.Data, { BUILT_IN_QUESTIONS });
