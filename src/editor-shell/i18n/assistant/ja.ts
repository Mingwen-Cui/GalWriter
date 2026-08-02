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
  shortDrama: '短編ドラマを生成',
  generateCards: 'カード生成',
  inputPlaceholder:
    'AIとストーリーを相談するか、キャラクター、シーン、ストーリーカードの生成・修正を依頼してください…',
  futureWriting: '将来の執筆提案',
  cardReview: {
    taskTitlePrefix: '提案',
    requestText: 'このカードと前後の物語に基づいて、具体的な修正案を出してください。',
    selectedCard: '選択したカード',
    adjacentContext: '処理するカードと隣接するストーリー',
    contextBadge: 'カードの文脈',
    removeAttachment: '添付を削除',
    analyzing: 'カードを解析中',
    complete: 'カードの提案を生成しました',
    exactlyThreeError: 'AI が3件の完全な提案を返しませんでした',
    fallbackDiagnosis: '現在のカードと前後の物語から3つの修正案をまとめました。',
    failure: 'カード分析を完了できませんでした：{reason}',
    retry: '後でもう一度お試しください',
    prompt: `あなたはGalgameのシナリオ編集者です。次の対象カードと前後の物語だけを分析し、画像を生成したり、キャンバスを直接変更したりしないでください。

{context}

このカードの最も重要な問題を指摘し、実際の内容に直接関係する実行可能な修正案をちょうど3件提示してください。「最適化する」「続きを書く」「別のアイデア」のような曖昧な表現は避け、各案はカード内の具体的な情報を対象にし、修正後の効果も説明してください。

JSONのみを返してください：
{"diagnosis":"具体的な診断を1文","options":[{"label":"短い操作タイトル","description":"具体的な修正方法と理由"}]}`,
  },
  welcomePrompts: {
    idea: {
      title: '新しいアイデアがある',
      description: 'ひとつのひらめきから、設定、キャラクター、対立を広げます。',
      prompt: '新しいアイデアがあります。完成した物語に広げるのを手伝ってください。',
    },
    continue: {
      title: '続きを書きたい',
      description: '現在の物語を次のシーン、会話、絵コンテへ進めます。',
      prompt: '続きを書きたいです。現在の内容から物語を進めてください。',
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
