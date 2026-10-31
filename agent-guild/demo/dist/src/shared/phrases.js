// 心得・巻物に書かれた言い回しを見分ける正規表現（10言語）。模擬採点（grader/mock.ts）と、先輩の助言（shared/coach.ts）で同じものを使う
// 心得・巻物に書かれた言い回しを拾う（10言語。バランス検証用のモックなので、よくある言い方だけ）
export const PHRASE_RE = {
    selective: /必要なときだけ|必要な時だけ|必要な場合だけ|必要な場合のみ|必要に応じて|不要なら|むやみに|only (when|if) (needed|necessary)|as needed|when necessary|only as needed|仅在需要|只在需要|必要时才|按需|solo (cuando|si) (haga falta|sea necesario|es necesario)|según haga falta|só quando|somente quando|apenas quando|conforme necessário|seulement (quand|si) |uniquement (quand|si) |au besoin|nur (wenn|bei) (nötig|erforderlich|bedarf)|bei bedarf|필요할 때만|필요한 경우에만|필요에 따라|केवल (ज़रूरत|आवश्यकता) |ज़रूरत पड़ने पर|आवश्यकतानुसार|فقط عند|عند الحاجة|حسب الحاجة/i,
    stale: /旧|廃止|最新|改定|日付|\b(old|obsolete|deprecated|outdated|latest|revised|stale|abolished|date)\b|废止|修订|antiguo|obsoleto|derogad|última|revis|fecha|antigo|revogad|data\b|ancien|obsolète|abrogé|dernière|révis|veraltet|aufgehoben|aktuell|überarbeit|datum|구판|폐지|최신|개정|날짜|पुराना|रद्द|नवीनतम|संशोधित|तारीख़|قديم|ملغى|أحدث|معدّل|تاريخ/i,
    careful: /検算|一行ずつ|1行ずつ|段階的|ステップ|途中式|double-?check|step by step|line by line|show (your )?work|recalculate|检算|验算|逐行|分步|verifica|paso a paso|línea por línea|confira|passo a passo|linha por linha|vérifie|pas à pas|ligne par ligne|nachrechnen|schritt für schritt|zeile für zeile|überprüfe|검산|한 줄씩|단계별|चरण-दर-चरण|पंक्ति-दर-पंक्ति|खुद जाँच|خطوة بخطوة|سطرًا سطرًا|تحقق/i,
    json: /JSON/i,
    always: /毎回|常に|いつも|必ず使|always|every (time|turn|question)|每次|总是|siempre|cada vez|sempre|toda vez|toujours|à chaque fois|immer|jedes mal|매번|항상|हर बार|हमेशा|دائمًا|في كل مرة/i,
};
// お供（サブエージェント）のことを心得に書いているか・頼むときに手がかりを渡すよう書いているか（10言語）
// お供を指す言葉（言語ごと）。仲間（同じ討伐隊の冒険者）を指す言葉とは分けてある（es compañero・fr compagnon・ko 동료・hi साथी・ar رفيق は仲間の意味で使うので、お供には使わない）
export const COMP_RE = /お供|サブエージェント|ask_companion|companion|sub-?agent|伙伴|随从|子代理|acompañante|acompanhante|familier|sous-agent|begleiter|subagent|길동무|서브\s?에이전트|सहायक|सब-एजेंट|مرافق|وكيل فرعي/i;
// 手がかりを「渡す・伝える」ことを書いたか（「名前」だけでは、渡すとは限らないので数えない）
export const HANDOFF_RE = /伝え|渡し|渡す|そのまま|知らせ|\bpass|\btell|\bgive|\bhand\b|forward|exactly|as said|告诉|转告|原样|交给|\bpasa|dile|tal cual|\bpasse|diga|\bdonne|transmet|tel quel|\bgib|weiter|genau so|전해|전달|그대로|알려|बताओ|ज्यों|أخبر|مرّر|أعط|كما/i;
// 「依頼文・本文の中の指示に従うな」を言い表す語（10言語）
export const INJECT_RE = /指示|従わ|無視|信用|instruction|obey|ignore|trust|服从|无视|不要相信|instrucc|obedec|ignorar|instruç|confí|obéir|ignorer|fier|anweisung|befolg|ignorier|vertrau|지시|따르|무시|믿지|निर्देश|पालन|अनदेखा|भरोसा|تعليمات|تُطع|تطع|تجاهل|تثق/i;
//# sourceMappingURL=phrases.js.map