export const assistantPanelJa = {
  newConversation: '新しい会話',
  back: '戻る',
  close: '閉じる',
  articleToGalgame: '文章をGalgameに変換',
  uploadArticle: '記事ドキュメントをアップロード',
  showAnalysis: 'AI解析の過程を表示',
  generateChapterRegions: '章の背景エリアを生成',
  generateCharacters: '候補キャラクターカードを生成',
  storyPartner: 'あなたのAIシナリオパートナーです',
  tryAsking: 'こんなふうに聞いてみてください：',
  position: '位置',
  documents: '参照ドキュメント',
  suggestions: '提案',
  send: '送信',
  heroTitle: 'アイデアを作品に仕上げるお手伝いをします',
  shortDrama: '短編ドラマをすぐ生成',
  generateCards: 'カード生成',
  inputPlaceholder:
    'AIとストーリーを相談するか、キャラクター、シーン、ストーリーカードの生成・修正を依頼してください…',
  futureWriting: '将来の執筆提案',
  shortDramaFlow: {
    storyOnlyPrompt:
      'この短編ドラマ用に、順番に進むストーリーカードだけを 6〜10 枚作成してください。確定した人物は「{characterName}」、シーンは「{sceneName}」です。既存の設定カードと関連付けられるよう、各ストーリーカードに両方の名前を自然に含めてください。人物カードとシーンカードは返さないでください。元の依頼：{request}',
    createCharacterPrompt:
      'この短編ドラマ用に、主要人物の設定カードを 1 枚だけ作成してください。JSON のみを返してください：{"cards":[{"type":"character","characterName":"...","identity":"...","appearance":"...","personality":"...","habits":"...","speechStyle":"...","experience":"...","relationships":"...","notes":"..."}]}。ストーリーカードとシーンカードは返さないでください。依頼：{request}',
    createScenePrompt:
      'この短編ドラマと確定済みの主要人物「{characterName}」用に、中心となるシーン設定カードを 1 枚だけ作成してください。JSON のみを返してください：{"cards":[{"type":"scene","sceneName":"...","location":"...","time":"...","weather":"...","visual":"...","sound":"...","items":"...","notes":"..."}]}。人物カードとストーリーカードは返さないでください。依頼：{request}',
    useLibraryScene: 'ライブラリのシーンを使う：{name}',
    createScene: 'AI で新しいシーンを作成',
    characterPlaced: '人物設定「{name}」を配置しました。中心となるシーンを選ぶか、AI で新しく作成してください。',
    scenePlaced: 'シーン設定「{name}」を配置しました。人物とシーンが確定したため、プロットを生成します。',
    characterCreated: '人物設定「{name}」を作成しました。中心となるシーンを選ぶか、AI で新しく作成してください。',
    sceneCreated: 'シーン設定「{name}」を作成しました。人物とシーンが確定したため、プロットを生成します。',
    characterGenerationFailed: '人物設定を生成できませんでした。選び直すか、もう一度試してください。',
    sceneGenerationFailed: 'シーン設定を生成できませんでした。選び直すか、もう一度試してください。',
    fallbackCharacterName: 'AI キャラクター',
    fallbackSceneName: 'AI シーン',
  },
  creativeStory: {
    taskTitle: 'リアルタイム創作',
    chooseGenre: '最初から舞台を決める必要はありません。今日はどんな物語に入りたいですか？',
    surpriseMe: 'まだ決めていないので、物語の扉を見せて',
    chooseRolePreference: 'ジャンルが決まりました。どんな人物を演じたいですか？',
    rolePreferenceHint: '演じたい役割、身分、ギャップを一文で書いてください。',
    chooseOpening: 'この方向には雰囲気があります。物語をどこから始めますか？',
    customDirection: '自分の言葉で説明する',
    directionHint: '混ぜたいジャンル、雰囲気、物語の感触を一文で書いてください。',
    chooseStoryDoor: '選択から三つの物語の扉を開きました。一番入りたいものを選ぶか、別の組を表示してください。',
    changeDoors: '別の物語の扉を見る',
    storyDoorFailed: '物語の扉を開けませんでした。別の方向を選ぶか、もう一度試してください。',
    chooseBackground:
      '最初の章となる物語の舞台を選ぶか、自分の言葉で新しい舞台を説明してください。',
    describeBackground: '自分で舞台を説明する',
    backgroundHint: '入りたい物語の舞台を説明してください。',
    choosePlayer: 'ジャンルと人物の方向が決まりました。演じる人物を候補から選んでください。',
    characterFallback:
      'AI の出力形式が不完全だったため、創作を続けられる4人の人物原型を用意しました。',
    chooseLead:
      '次に、もう一人の重要人物を選んでください。二人の関係を中心に物語が進みます。',
    preparing:
      '登場人物と第一幕の準備ができました。プレイ中、AI は重要な場面で決定を待ちます。',
    enter: 'ゲームを始める',
    resume: '前回の創作を続ける',
    generatedCharactersFailed: '人物を準備できませんでした。もう一度お試しください。',
    openingFallback:
      'AI の出力形式が不完全だったため、ジャンルと人物からすぐ始められる第一幕を用意しました。',
    openingFailed: '第一幕を準備できませんでした。もう一度お試しください。',
  },
  cardReview: {
    taskTitlePrefix: '提案',
    requestText: 'このカードと前後の物語に基づいて、具体的な修正案を出してください。',
    selectedCard: '選択したカード',
    adjacentContext: '処理するカードと隣接するストーリー',
    contextBadge: 'カードの文脈',
    removeAttachment: '添付を削除',
    showSelectedCards: '選択カードを表示',
    analyzing: 'カードを解析中',
    complete: 'カードの提案を生成しました',
    exactlyThreeError: 'AI が3件の完全な提案を返しませんでした',
    fallbackDiagnosis: '現在のカードと前後の物語から3つの修正案をまとめました。',
    failure: 'カード分析を完了できませんでした：{reason}',
    retry: '後でもう一度お試しください',
    useSuggestion: '続けて編集',
    compactInstruction:
      '出力制限：diagnosis は24文字以内。各 label は8文字以内、description は具体的な修正を一文だけで40文字以内にしてください。理由の説明、カード内容の繰り返し、Markdown は不要です。',
    prompt: `あなたはGalgameのシナリオ編集者です。次の対象カードと前後の物語だけを分析し、画像を生成したり、キャンバスを直接変更したりしないでください。

{context}

このカードの最も重要な問題を指摘し、実際の内容に直接関係する実行可能な修正案をちょうど3件提示してください。「最適化する」「続きを書く」「別のアイデア」のような曖昧な表現は避け、各案はカード内の具体的な情報を対象にし、修正後の効果も説明してください。

JSONのみを返してください：
{"diagnosis":"具体的な診断を1文","options":[{"label":"短い操作タイトル","description":"具体的な修正方法と理由"}]}`,
  },
  profileFlow: {
    welcome: {
      title: 'あなたのことを知りたい',
      description: 'いくつかの気軽な質問から、あなたらしい物語の始まりを見つけます。',
    },
    intro: '創作の好みについて 5 つだけ質問します。答えたくない項目はいつでもスキップできます。',
    savedIntro: '保存した創作の好みを覚えています。更新するか、その好みで新しい始まりを作れます。',
    progress: '質問 {current}/5',
    chooseOne: 'いちばん近い答えを選ぶか、自分の言葉で教えてください。',
    chooseUpToThree: '3 つまで選んでから完了を押してください。自分の言葉でも答えられます。',
    skip: 'この質問をスキップ',
    custom: '自分の言葉で答える',
    customHint: '自由に教えてください。物語の好みとしてだけ使います。',
    done: '選択を完了',
    useSaved: '保存した好みで作る',
    refresh: '好みを更新する',
    generating: '好みに合わせて、異なる 3 つの始まりを考えています…',
    resultIntro: '選んだ好みから 3 つの物語の始まりを作りました。ひとつ選ぶか、もう一組作れます。',
    regenerate: '別の 3 つを出す',
    save: 'この端末に好みを記憶する',
    saved: 'この端末の創作の好みとして保存しました。あとで更新できます。',
    saveFailed: 'この端末に好みを保存できませんでした。',
    chooseOpening: 'この始まりを選ぶ',
    generateCards: 'この始まりからカードを作る',
    discuss: 'まずこの始まりを相談する',
    openingSelected: '「{title}」を選びました。次は何をしますか？',
    discussHint: 'この始まりのどこを調整したいか教えてください。',
    failure: '完全な始まりを 3 つ作れませんでした。もう一度試してください。',
    profileSummary:
      '人物の傾向：{persona}\nジャンル：{genres}\n関係性と物語の緊張：{dynamics}\n世界観：{worlds}\nプロットの方向：{plots}\n補足：{notes}',
    batchBackgrounds: {
      character: 'キャラクター設定',
      scene: '世界観とシーン',
      logic: '分岐と条件',
      story: 'プロット進行',
    },
    questions: {
      persona: {
        title: '物語に入るとき、あなたはどんな人に近いですか？',
        action: '先に動く人',
        observer: '秘密を抱えた観察者',
        tender: '素直になれない優しい人',
        unpredictable: '場の空気を変える存在',
      },
      genre: {
        title: '夢中になれるジャンルは？',
        mystery: 'ミステリーと秘密',
        romance: '恋愛と憧れ',
        healing: '癒やしの日常',
        fantasy: 'ファンタジー冒険',
        scifi: '近未来 SF',
        youth: '青春・学園',
      },
      dynamics: {
        title: 'どんな関係性や物語の緊張を味わいたいですか？',
        slowburn: 'ゆっくり近づく関係',
        rivals: '惹かれ合うライバル',
        reunion: '運命の再会',
        power: '危うい力関係',
        contrast: '強い性格のギャップ',
        trust: '裏切りのあとに築く信頼',
      },
      world: {
        title: '今回はどんな世界観に入りたいですか？',
        city: 'ひびの入った現代都市',
        campus: 'どこかがおかしい学校',
        fantasy: '架空のファンタジー世界',
        future: '技術で変わった近未来',
        closed: '謎を抱えた閉鎖空間',
        ordinary: '少しずつ奇妙になる日常',
      },
      plot: {
        title: '物語をどう動かし始めたいですか？',
        mission: '緊張感のある任務',
        mystery: '追わずにいられない手がかり',
        encounter: '偶然の出会い',
        return: '誰か、または何かの帰還',
        choice: 'すべてを変える選択',
        growth: '小さな願いから始まる冒険',
      },
    },
    openingPrompt: `あなたは GalWriter の物語パートナーです。次の創作の好みに基づいてください。\n{profile}\n\nビジュアルノベル向けに、はっきり異なる物語の始まりを必ず 3 つ作ってください。各始まりには title、world、plot、matchReason、80〜120 字の opening が必要です。選ばれた世界観と物語の方向性を必ず反映してください。まだキャンバスカードは作らないでください。JSON のみを返してください：{"openings":[{"title":"","world":"","plot":"","matchReason":"","opening":""}]}`,
    generatePrompt: `選んだ始まりを GalWriter のビジュアルノベルの導入に広げてください。創作の好み：\n{profile}\n\n選んだ始まり：\n{opening}\n\nキャラクターカード、シーンカード、6〜10 枚のストーリーカードを返してください。すべてのカードに、今回のどの部分かを示す短い batchTitle を付けてください。ストーリーカードには、世界観の提示・関係の発展・物語の加速を分ける短い chapterTitle も必須です。キャンバスは生成部分ごとに背景エリアを作成します。`,
    discussPrompt: `選んだ物語の始まりについて、まだキャンバスカードを作らずに相談を続けてください。創作の好み：\n{profile}\n\n選んだ始まり：\n{opening}\n\nユーザーのメッセージ：\n{message}`,
    persistentContext: '保存済みの創作の好み：\n{profile}',
  },
  welcomePrompts: {
    idea: {
      title: '新しいアイデアがある',
      description: 'ひとつのひらめきから、設定、キャラクター、対立を広げます。',
      prompt: '新しいアイデアがあります。完成した物語に広げるのを手伝ってください。',
    },
    continue: {
      title: '遊びながら物語をつくる',
      description: 'まず舞台を選び、遊びながら AI と次の展開を決めます。',
      prompt:
        'AI と会話しながら遊ぶ形で物語をつくりたいです。まだ続きやカードは生成せず、まず短い質問で物語の舞台を選ぶか説明できるようにしてください。その後は一度に少しだけ進め、重要な場面ごとに次の展開を聞いてください。',
    },
    article: {
      title: '文章をGalgameに変換したい',
      description: 'PDFやWordをAIアシスタントへアップロードすると、編集可能なgalgameに変換します。',
      prompt:
        '文章をgalgameに変換したいです。PDFまたはWordをアップロードするので、内容を抽出して編集可能なビジュアルノベルカードにしてください。',
    },
  },
  articleFlow: {
    uploadTitle: '文章をアップロードして、学習用の章別シナリオに分解します',
    uploadDescription:
      '文章の内容、構成、各章の要点を整理し、学び方を確認したうえで、章ごとの背景エリアとストーリーカードをキャンバスに作成します。',
    analyzingTitle: 'AIが文章を解析しています…',
    errorTitle: '文章の解析で問題が発生しました',
    readyTitle: '文章の構成解析が完了しました',
    dropTitle: 'PDF または Word 文書をここへドロップ',
    dropDescription:
      'クリックしてファイルを選択することもできます。PDF、Word、Excel、PPT、一般的なテキストファイルに対応しています。',
    learningPrompt: '読者にこの文章をどのように学んでもらいたいですか？',
    characterDescription:
      'AIアシスタントが3枚の人物テンプレートと1枚の空白入力カードを配置します。',
    analysisRunning: 'AIが文章を解析中です...',
    analysisFailed: 'AIによる文章解析に失敗しました',
    analysisComplete: 'AIによる文章診断が完了しました',
    documentSummary: '{count}件のドキュメントを読み込みました（約{characters}文字）。',
    documentSummaryEmpty: 'アップロード後、ここにドキュメントの解析結果が表示されます。',
    documentReading: 'アップロードしたドキュメントを読み込んでいます...',
    documentExtracting: '本文、見出し、段落、読み取り可能なテキストを抽出しています。',
    documentExtracted:
      '{count}件のドキュメントから読み取り可能なテキストを抽出しました（約{characters}文字）。',
    textApiMissing: '実際のAI読解を実行できません。テキストAI APIが設定されていません。',
    steps: {
      reading: {
        title: '文章内容を読み取り',
        pending: '本文、見出し、段落のテキスト抽出を待機しています。',
      },
      ideas: {
        title: 'テーマと中心的な観点を特定',
        pending: 'AIがテーマ、主張、重要な概念を特定するのを待機しています。',
        active: 'AIが全文を読み、テーマ、中心的な観点、重要な概念を特定しています。',
        fallback: '文章のテーマと中心的な観点を特定しました。',
      },
      chapters: {
        title: '章構成を整理',
        pending: 'AIが文章の論理に沿って章と知識の順序を分けるのを待機しています。',
        active: 'AIが文章の論理に沿って章、階層、知識の順序を整理しています。',
        fallback: '文章の論理に基づいて章構成を整理しました。',
      },
      teaching: {
        title: '学習ルートを設計',
        pending: 'AIが質問、解説、フィードバック、学習ルートを設計するのを待機しています。',
        active: 'AIが知識ポイントを、教えられる質問、解説、フィードバックの流れに変換しています。',
        fallback: '学習ルートを設計しました。',
      },
      galgame: {
        title: 'Galgameシーンに変換',
        pending: 'AIが役割、シーン、会話テンポ、章の背景エリアを設計するのを待機しています。',
        active: 'AIが学習用の役割、シーン、会話テンポ、章の背景エリアを設計しています。',
        fallback: 'Galgame化するための役割、シーン、章の背景エリアを設計しました。',
      },
      teachingStyle: {
        title: '学習スタイルを選択',
        pending: '実際の解析が完了したら、Galgameに変換する方法を選択してください。',
        complete:
          '実際の解析が完了しました。対話形式または講義形式を選ぶと、上の分析に基づいて章の背景エリアとストーリーカードを生成します。',
        evidence:
          '以降の生成では、今回のテーマ、章構成、学習ルート、Galgame変換の分析結果を使用します。',
      },
    },
  },
} as const;
