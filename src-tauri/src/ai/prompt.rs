//! Prompt 构建：人设 + 命盘事实 + 意图模板。
//! 6 主题模板从原版 InsightPanel.tsx **逐字移植**；宫位/飞化模板同源；
//! 合盘方法论与夫妻宫断语从 heming-knowledge.ts 移植。快照单测钉住稳定性。

use super::chart_text::{chart_text, palace_focus, patterns_text, star_palace_name};
use super::{ChatMsg, InterpretIntent, TimeView, TopicKey};
use serde_json::Value;

const PERSONA: &str = r#"你是一位深谙倪海厦《天纪》体系的紫微斗数命理师。
规则：
1. 只依据下方给定的命盘事实作答，绝不编造盘外信息；
2. 命理专名（星曜、宫位、四化、神煞）保持原文用字；
3. 按 **【标题】** 分段输出，段落之间空一行；
4. 语言平实直接，先定性再展开；
5. 六亲相关内容仅作传统参考，不作绝对论断。"#;

/// 6 主题模板 —— 与原版 InsightPanel.TOPIC_PROMPTS 逐字一致
fn topic_prompt(topic: TopicKey) -> &'static str {
    match topic {
        TopicKey::Overview => {
            r#"请生成命格总览，按以下结构输出：

**【命格定性】**
用一句话概括这个命盘的核心格局与命主气质。

**【主星解读】**
命宫主星的核心特质，引用倪海厦原话或观点。

**【三方四正】**
财、官、迁三宫的联动分析及整体格局。

**【当前大限】**
当下大限运势方向与最值得关注的事项。

**【优势与注意】**
命盘天赋优势，以及需要注意的风险或功课。"#
        }
        TopicKey::Love => {
            r#"请深度分析感情婚姻运，按以下结构输出：

**【感情格局】**
一句话定性感情命格。

**【夫妻宫分析】**
夫妻宫主星、四化，以及倪海厦体系的具体解读。

**【三方联动】**
相关宫位对感情的影响。

**【当前大限感情运】**
当下10年感情走向与关键节点。

**【实际建议】**
具体可行的感情建议。"#
        }
        TopicKey::Career => {
            r#"请深度分析事业运，按以下结构输出：

**【事业格局】**
一句话定性事业命格，宜任职或宜创业。

**【官禄宫分析】**
官禄宫主星、四化，以及倪师对这种配置的判断。

**【财帛宫联动】**
财运与事业的关系，财路来源分析。

**【当前大限事业运】**
当下10年事业走向。

**【实际建议】**
适合的方向、行业与策略。"#
        }
        TopicKey::Wealth => {
            r#"请深度分析财运，按以下结构输出：

**【财运格局】**
一句话定性财运模式，是主动财还是被动财。

**【财帛宫分析】**
财帛宫主星、四化，财富来源与流动模式。

**【田宅宫（财库）】**
积蓄能力与不动产运势分析。

**【当前大限财运】**
当下财运走向与注意事项。

**【理财建议】**
具体的财务建议。"#
        }
        TopicKey::Health => {
            r#"请分析健康运势，按以下结构输出：

**【疾厄宫主星】**
疾厄宫星曜与健康含义。

**【主要风险】**
结合倪海厦子午流注理论，分析主要健康隐患与需关注的部位。

**【大限健康走势】**
当下健康趋势与关键时间段。

**【预防建议】**
具体注意事项与养生方向。"#
        }
        TopicKey::Personality => {
            r#"请深度解析性格特质，按以下结构输出：

**【命宫主星性格】**
命宫主星的核心性格特质，引用倪师原话。

**【三方性格综合】**
财、官、迁三宫对性格的影响，全貌描绘。

**【人际关系模式】**
与他人互动方式、待人处世风格。

**【优势与人生课题】**
天赋优势，以及需要面对的人生功课。"#
        }
    }
}

/// 宫位解读模板 —— 与原版 InsightPanel 点宫位注入的 prompt 逐字一致
fn palace_prompt(name: &str, role: &str, star_desc: &str) -> String {
    format!(
        r#"请重点分析【{name}】（主管：{role}），该宫主星为{star_desc}，按以下结构输出：

**【宫位定性】**
{name}在命盘中的意义，以及这种星曜配置的整体判断。

**【主星解读】**
主星在此宫的倪海厦体系解读，引用具体观点。

**【三方四正联动】**
三方四正宫位对此宫的影响。

**【实际建议】**
基于此宫的具体建议。"#
    )
}

/// 飞化解读模板 —— 与原版 InsightPanel 四化注入的 prompt 逐字一致
fn sihua_prompt(view_label: &str, star_name: &str, si_hua: &str, palace_name: &str) -> String {
    format!(
        r#"请分析【{view_label}{star_name}化{si_hua}】的飞化影响，按以下结构输出：

**【化{si_hua}基本含义】**
化{si_hua}在倪海厦体系中的核心含义，以及{star_name}化{si_hua}的特殊含义。

**【落宫影响】**
{star_name}化{si_hua}落在【{palace_name}】，该宫主管的领域受到何种影响，倪师如何解读。

**【三方四正飞化路径】**
化{si_hua}入{palace_name}后，对其三方四正（对宫、两个三合宫）的联动影响。

**【当前运势影响】**
在{view_label}时间维度下，此化{si_hua}对命主近期运势的具体影响。

**【实际建议】**
基于此四化的具体可操作建议。"#
    )
}

/// 当前日期行：LLM 不知道"今天"，不注入时"今年/流年"会按训练语料年代误答
/// （如 2026 年却答 2024 年）。每次构建消息时取本机当前日期。
fn today_line() -> String {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    format!("今日公历：{today}。涉及“今年 / 当前年份 / 流年 / 当下”时一律以此日期为准，禁止自行推测年份。\n\n")
}

fn system_for(chart: &Value, patterns: &[Value]) -> String {
    format!("{PERSONA}\n\n{}\n{}\n{}", today_line(), chart_text(chart), patterns_text(patterns))
}

/// 排盘页解读：[system, ...history, user(意图模板)]
/// intent=None 为自由问答：问题应是 history 最后一条 user，不追加内容。
pub fn build_interpret_messages(
    chart: &Value,
    patterns: &[Value],
    intent: Option<&InterpretIntent>,
    history: &[ChatMsg],
) -> Result<Vec<ChatMsg>, String> {
    let mut msgs = vec![ChatMsg::system(system_for(chart, patterns))];
    msgs.extend_from_slice(history);
    if let Some(intent) = intent {
        let prompt = match intent {
            InterpretIntent::Topic { topic } => topic_prompt(*topic).to_string(),
            InterpretIntent::Palace { branch } => {
                let (name, stars, role) = palace_focus(chart, *branch)
                    .ok_or_else(|| format!("宫位不存在（branch={branch}）"))?;
                palace_prompt(&name, role, &stars)
            }
            InterpretIntent::Sihua {
                star_name,
                si_hua,
                view,
            } => {
                let palace_name = star_palace_name(chart, star_name)
                    .ok_or_else(|| format!("星曜 {star_name} 不在盘中"))?;
                let view_label = match view {
                    TimeView::Daxian => "大限",
                    TimeView::Liunian => "流年",
                };
                sihua_prompt(view_label, star_name, si_hua, &palace_name)
            }
        };
        msgs.push(ChatMsg::user(prompt));
    }
    Ok(msgs)
}

// ────────────────── 合盘知识库（自 heming-knowledge.ts 移植） ──────────────────

const HEMING_METHODOLOGY: &str = r#"## 合盘分析核心框架（倪海厦体系 + 《紫微斗数全书》综合）

### 一、双宫联参原则（倪海厦最重要的婚姻断法）

**核心口诀：「看婚姻，光看夫妻宫，大错特错，一定要同时看福德宫。」**

- **夫妻宫**：看配偶的星性、外形、性格、互动模式
- **福德宫**：代表夫妻深层感情、婚姻能否长久
- **倪师案例**：“有人夫妻宫很好，福德宫很烂，散！夫妻要散。”

**因此合盘时必须同时分析双方的：命宫 + 夫妻宫 + 福德宫**

---

### 二、天作之合的判断标准

**最高级匹配（天作之合）**：
- 甲方夫妻宫主星 = 乙方命宫主星
- 乙方夫妻宫主星 = 甲方命宫主星
- 两者互相对应，则为命中注定的一对

**次级良配**：
- 一方夫妻宫主星 = 对方命宫主星（单向对应）
- 双方命宫星性五行相生（如木命配土命、土命配水命）
- 双方大限同走旺运

**凶兆组合**：
- 双方互相化忌冲对方命宫（互为冤家）
- 一方化忌飞入另一方夫妻宫（带给对方婚姻伤害）
- 双方夫妻宫皆有重煞无吉星

---

### 三、完整合盘五步法

**第一步：评估双方命格基础**
- 双方命宫格局是否般配（同类型 or 互补型）
- 重点看：命宫 + 身宫 + 福德宫的星性搭配
- 警戒：双方皆为杀破狼格（两虎相争）；或一强一弱过度悬殊

**第二步：夫妻宫互参**
- 甲方夫妻宫主星 → 是否对应乙方命宫/三合方星？
- 乙方夫妻宫主星 → 是否对应甲方命宫/三合方星？
- 双方夫妻宫各自的四化状态（化禄/化忌影响最大）

**第三步：太阳太阴星象分析**
- 女命：太阳代表丈夫；太阳庙旺=旺夫，落陷化忌=克夫
- 男命：太阴代表妻子；太阴庙旺=妻美贤，化忌=婆媳不和
- 这两颗星在双方命盘中的状态，直接影响婚姻质量

**第四步：四化飞化互参（高级技法）**
- 甲方生年干 → 找到四化星 → 这些星落在乙方命盘哪个宫位
  - 化禄飞入乙方命宫/财帛宫：对乙方有正向帮助
  - 化忌飞入乙方夫妻宫：带给乙方婚姻伤害
  - 化忌飞入乙方命宫：自身给对方带来压力
- 乙方生年干 → 反向飞化分析甲方
- 形成"飞化互参"，判断双向的"缘分类型"

**第五步：大限同步分析**
- 双方当前大限是否同走旺运：俱旺=最佳时机，俱衰=共同挑战
- 一方旺一方衰：需有意识平衡双方状态
- 流年三合方桃花星聚集：当年结婚好时机

---

### 四、缘分类型判断

| 化缘类型 | 特征 |
|---------|------|
| 化禄引动 | 正缘、真爱，感情甜蜜顺遂 |
| 化权引动 | 主动争取的感情，有张力，有主导方 |
| 化科引动 | 和谐相处的缘分，互相尊重，白头偕老型 |
| 化忌引动 | 逆缘/冤家，彼此折磨但难以分离，需修行方可化解 |
| 双方互化忌 | "冤家路窄"型，感情强烈但痛苦并存，前世欠债型 |

---

### 五、婚期判断三层法

**第一层：本命盘格局**
- 夫妻宫无煞：宜早婚
- 夫妻宫有煞无吉：宜晚婚（男30以上，女27以上）
- 武曲、廉贞、七杀、破军在夫妻宫：一律建议晚婚

**第二层：大限**
- 大限夫妻宫吉星多：该十年有结婚机会
- 大限夫妻宫化忌：该十年感情受阻

**第三层：流年**
- 红鸾、天喜入命宫或夫妻宫：该年婚恋有动
- 流年宫位落到夫妻宫：该年婚姻是重点
- 流年三合方桃花星汇集：该年感情机遇多

---

### 六、各宫位结婚情形

| 流年宫位 | 结婚情形 |
|---------|---------|
| 夫妻宫 | 正常感情发展结婚 |
| 命宫 | 自己主动出击结婚 |
| 子女宫 | 奉子成婚（先上车后补票） |
| 田宅宫 | 因家庭、房产缘故结婚 |
| 父母宫 | 奉父母之命，经长辈介绍 |

---

### 七、克夫/克妻的具体标志

**克夫命（非传统含义）倪师定义**：
> “克夫的女孩子，就是太太在前面走，先生在后面满头大汗提着大包小包付钱，好不容易等到车，先生还要帮太太开门。这叫克夫。”
> “旺夫，一个太太完全让先生没有后顾之忧。”

**具体标志**：
- 夫妻宫廉贞+贪狼/破军/七杀（三凶组合）
- 太阳落陷化忌（女命）
- 太阴化忌（男命）
- 夫妻宫四煞齐聚无吉星
- 寡宿孤辰入命宫或夫妻宫
- 福德宫破军陷落 + 廉贞平（水中做冢格）

---

### 八、事业合作合盘判断

**主要参考宫位**：
- 官禄宫：双方事业宫星性是否兼容
- 兄弟宫（仆役宫）：代表合伙关系
- 福德宫：能否同甘共苦

**事业合作吉象**：
- 双方命宫互补（一谋一行）
- 一方官禄宫化禄飞入另一方官禄宫
- 兄弟宫有禄存无化忌冲

**事业合作凶象**：
- 双方化忌互冲官禄宫
- 对方命宫化忌飞入己方财帛宫（对方消耗自己钱财）
- 巨门在兄弟/仆役宫：倪师："巨门在朋友宫，代表跟朋友合伙会朋友变仇人"

---

### 九、感情相位类型（命格兼容性速判）

| 双方组合 | 兼容性 | 说明 |
|---------|-------|------|
| 紫微 + 天府 | ★★★★★ | 帝星遇财库，相互成就，最稳定 |
| 天相 + 任何星 | ★★★★ | 印星佐才，天相适应性强 |
| 天梁 + 天同 | ★★★★ | 老成与温和互补，白头偕老型 |
| 太阳 + 太阴 | ★★★★ | 日月并明，经典互补，阴阳调和 |
| 七杀 + 七杀 | ★★ | 两虎相争，火花大，矛盾多 |
| 破军 + 破军 | ★★ | 双破，彼此破坏，婚姻不稳 |
| 廉贞 + 七杀/破军 | ★ | 三凶组合之二，生离死别风险最高 |
| 杀破狼 + 机月同梁 | ★★★ | 动静互补，但需磨合，一方开拓一方守成 |
| 紫破 + 廉府 | ★★★★ | 格局相当，互相吸引 |
| 武曲 + 天同 | ★★★ | 刚柔互济，武曲收敛遇天同温和，能互补 |

---

### 十、倪海厦合盘核心名言汇总

1. **“看婚姻，光看夫妻宫，大错特错，一定要同时看福德宫。”**
2. **“廉贞贪狼/廉贞破军在夫妻宫，不管男命女命，非生离即死别。”**
3. **“廉贞七杀——半路埋尸；廉贞破军——水中做冢；廉贞贪狼——横夭夭折。”**
4. **“太阳化忌，上不见父，下不见子，中不见夫。“（女命那十年配偶有重大灾难）**
5. **“男人的命，最怕太阴化忌，婆媳不和，太太跟妈妈一定不和。”**
6. **“旺夫，一个太太完全让先生没有后顾之忧；克夫是感情太好，完全以对方为主。”**
7. **“巨门在朋友宫，跟朋友合伙会朋友变仇人。”**
8. **“如果你娶个太太是七杀入命，那你差不多毁了一半了，很累啊，草木皆兵。”**"#;

/// 十四主星入夫妻宫断语（自 heming-knowledge.STAR_IN_FUQI_GU 移植，仅命盘夫妻宫实际
/// 出现的主星才注入 prompt）。原版「天梁」条目有一处乱码字节，此处按文义修复为「、」。
fn star_fuqi_block(star: &str) -> Option<&'static str> {
    Some(match star {
        "紫微" => r#"【紫微入夫妻宫】
一句话核心：配偶高傲能干，宜晚婚，感情以尊重为基础
吉象：三方有辅弼相夹，配偶贤能有才，婚后得贵助；三合见禄主财禄双全
凶象：孤君无辅，配偶强势难沟通；辰戌宫夫妻情分淡薄；会破军：婚前有诸多阻碍
配偶：配偶气质高傲，有主见，自尊心强，能力强但不轻易表达情感
婚期：宜晚婚（男30以上，女27以上），早婚多挫折
倪师：紫微在夫妻宫，孤克，宜晚婚，感情好但沟通成本高"#,
        "天机" => r#"【天机入夫妻宫】
一句话核心：婚姻多变，宜年龄差较大的配偶
吉象：见禄存或化禄：感情尚可维持；会太阴：增添细腻温柔
凶象：化忌或会煞：感情变化大，易有分离；天机善变，配偶对感情举棋不定
配偶：配偶聪明多变，心思细腻，宗教哲学缘深，有点神经质
婚期：宜年龄差异较大（差6岁以上），可降低双方变化冲突
倪师：天机善变，不宜独坐，婚姻充满变化"#,
        "太阳" => r#"【太阳入夫妻宫】
一句话核心：男命助妻，女命旺夫；落陷化忌则反主刑克
吉象：庙旺（卯至申宫）：配偶能干，男命有贤内助；女命嫁旺夫，婚姻美满
凶象：落陷（酉至寅宫）：男命配偶病弱，女命嫁庸夫；化忌：女命"上不见父，下不见子，中不见夫"，那十年丈夫有重大灾难
配偶：配偶开朗大方，有公众形象意识，慷慨但有时过于强势
婚期：感情走势始热终冷，宜保持适当距离维持新鲜感
倪师：太阳化忌，上不见父，下不见子，中不见夫——女命那十年丈夫必有重大灾祸"#,
        "武曲" => r#"【武曲入夫妻宫】
一句话核心：寡宿之星，婚姻刑克，一律宜晚婚
吉象：武曲化禄：配偶有财能力，但男命反嫌妻太能干；见禄存夹辅：婚姻稳固有财
凶象：化忌：孤寡，难婚，或配偶身有残疾；武曲七杀（卯酉宫）：婚姻恶劣之兆；遇四煞任一：主离婚；武曲破军：见煞忌刑曜婚姻必不利
配偶：配偶刚烈独立，说话直接，不善表达情感，经济能力强但性格较孤克
婚期：武曲系一律建议30岁以后结婚，早婚早散
倪师：武曲化忌，为刑囚之星，武曲系婚姻宜晚"#,
        "天同" => r#"【天同入夫妻宫】
一句话核心：配偶温和享乐，宜年龄差较大，晚婚为吉
吉象：见禄存或化禄：配偶温和带财，家庭安稳；与太阴同：感情温柔甜蜜
凶象：化忌：感情刚开始尚可，逐渐转淡，因协调不良引起怨怼；遇煞多：懒散变成负担
配偶：配偶温和善良，乐观随和，但可能懒散，享乐主义较强
婚期：男娶比自己小、女嫁比自己大，年龄差8年以上为最佳结发"#,
        "廉贞" => r#"【廉贞入夫妻宫】
一句话核心：夫妻宫最不稳定的主星，生离死别风险高
吉象：廉贞天府（子午）：配偶温和清秀，感情尚可，配偶多为薪水族
凶象：廉贞贪狼：非生离即死别；廉贞破军：水中做坟墓；廉贞七杀：半路埋尸体；化忌：感情骚扰不断，和好破裂循环；与火星同宫：纵有吉曜也分居
配偶：配偶外形出众，善于交际，情绪价值高，但不稳定；可能离多聚少
婚期：男命宜配年少之妻（年轻6-12岁），女命宜配年长之夫
倪师：廉贞贪狼/廉贞破军在夫妻宫，不管男命女命，非生离即死别；廉贞七杀——半路埋尸；廉贞破军——水中做冢；廉贞贪狼——横夭（夭折）"#,
        "天府" => r#"【天府入夫妻宫】
一句话核心：善曜，主生离不死别，感情平稳但平淡
吉象：见禄存或化禄：财禄双全，感情稳定；三方无煞：夫妻平静和谐
凶象：辅弼单星：易有第二次婚姻；遇四煞：感情漠然，生离概率增加
配偶：配偶温文尔雅，兴趣广泛，守财有原则，工作能力强，但偏保守
婚期：男命配偶年长，女命配偶年少；感情稳定但需主动经营"#,
        "太阴" => r#"【太阴入夫妻宫】
一句话核心：喜清秀温柔配偶；落陷加煞则感情多变
吉象：庙旺（子至午）见吉：配偶秀气有成就，男命妻美；女命：自身秀美有气质
凶象：落陷（未至亥）：感情易变，配偶健康欠佳；化忌（男命尤忌）：婆媳不和，妻子与母亲必起冲突；遇火铃：感情重大变故
配偶：配偶温柔秀气，细腻敏感，重感情，但有时情绪化
婚期：无特定约束，但落陷时宜晚婚
倪师：男人的命，最怕太阴化忌，婆媳不和，太太跟妈妈一定不和的"#,
        "贪狼" => r#"【贪狼入夫妻宫】
一句话核心：桃花最旺，婚姻不稳，外遇风险高
吉象：化禄：配偶才艺佳，风情万种，感情甜蜜（但外遇风险不减）；遇化科：减少外遇
凶象：化忌：多二次婚姻；紫微贪狼（卯酉）：配偶多外出，有外遇之兆；遇四煞：必生离；午宫贪狼（武官星）：反主武职配偶，较稳定
配偶：配偶才艺超群，社交能力强，异性缘极好，但欲望旺盛，难以约束
婚期：早婚感情多变，宜晚婚；婚前务必了解对方异性关系
倪师：贪狼除了指桃花星，也指酒色财气赌，统统在贪狼里面；贪狼在午宫是武官星，不要随便批桃花"#,
        "巨门" => r#"【巨门入夫妻宫】
一句话核心：口舌是非多，夫妻易争吵，需太阳化解
吉象：太阳庙旺相会：反主婚姻和美，口才化为沟通利器；化禄：妻子贤能，财路因妻而开
凶象：化忌：配偶爱唠叨，是非不断；陀罗同度：夫妻自寻烦恼；独守无吉：感情压抑，深层矛盾多
配偶：配偶口才好，嫉妒心强，在乎面子，有时过于挑剔，但内心深情
婚期：无特定约束，但需做好长期沟通磨合的心理准备"#,
        "天相" => r#"【天相入夫妻宫】
一句话核心："亲上加亲"良缘，夫唱妇随，合作型婚姻
吉象：见辅弼双全：感情忠诚，婚姻稳固；配偶正直踏实；天相三合见禄：财禄可期
凶象：辅弼单星：可能预示再婚；遇煞多：感情中压抑委屈，不善表达
配偶：配偶正直踏实，守信用，不喜欢冲突，善于协调，是绝佳的生活伴侣
婚期：多为同学、同事、街坊等熟识关系发展，宜夫妻合作共事"#,
        "天梁" => r#"【天梁入夫妻宫】
一句话核心：喜责任感强或年纪较长的配偶，婚前多波折
吉象：见禄：配偶有福德，感情踏实；三合方有吉：感情经营稳重理智
凶象：化忌或见煞：爱唠叨，强势说服，感情疏离；天梁配天马：夫妻因环境分散；婚前易初恋失败
配偶：配偶责任感强、稳重老成，善讲道理，但偶有说教倾向
婚期：婚前多波折是常态，一旦结婚反而稳固；无煞婚后情缘更深"#,
        "七杀" => r#"【七杀入夫妻宫】
一句话核心："鸳衾半冷"——聚少离多，宜晚婚30岁后
吉象：庙旺（寅申宫）：配偶虽刚强但忠诚，一旦投入则全力付出；化禄相助：减轻孤克
凶象：遇煞：感情表面和谐内心不满，男命主二娶；女命宜偏房继室；卯酉宫（武曲七杀）：婚姻运最差
配偶：配偶刚强孤僻，一见钟情快，离开也快，恋爱冷热均快
婚期：一律宜晚婚，30岁后婚姻较稳固；早婚多刑克
倪师：七杀居夫妇而鸳衾半冷（古赋）；如果你娶个太太是七杀入命，那你就差不多毁了一半了，很累啊，草木皆兵"#,
        "破军" => r#"【破军入夫妻宫】
一句话核心：婚姻破耗之星，无人出其右，追求无约束感情
吉象：化禄：破而后立，感情历经波折反而能走到最后；英星入庙：配偶英挺有个性
凶象：化忌：破坏殆尽，多一婚或不婚；紫微破军（丑未）：不加煞亦克，加煞必离；与廉贞：水中做坟墓；中年后有分床分居之象
配偶：配偶追求自由，不喜约束，勇于突破，但婚姻观念薄弱，一生变动大
婚期：婚前易一见钟情或草率结婚，宜拉长相处时间再做决定
倪师：廉贞破军在夫妻宫，水中做坟墓；破军是婚姻破坏力最强的星"#,
        _ => return None,
    })
}

const SIHUA_IN_FUQI: &str = r#"四化在夫妻宫断语：
化禄：与配偶有先天缘分，配偶个性乐观，婚后感情更好，配偶越来越会赚钱，缘分深厚；自化禄则财来财去，感情有但难守
化权：婚姻多为主动争取而来，配偶掌握决策权，大部分事情配偶自行裁决，需学会放手；争取型婚姻，越强求越难得
化科：视为小禄，能与配偶和谐相处，有贵人缘，利于恋爱结婚；科在夫妻主配偶有名声或专业技能
化忌：欠下婚姻债务，早婚早离，建议晚婚或不婚；配偶对本人有怨言；化忌冲夫妻宫尤凶——生离死别之兆"#;

/// 取夫妻宫（name == "夫妻宫"）的主星名列表
fn fuqi_majors(chart: &Value) -> Vec<String> {
    chart
        .get("palaces")
        .and_then(Value::as_array)
        .map(|palaces| {
            palaces
                .iter()
                .filter(|p| p.get("name").and_then(Value::as_str) == Some("夫妻宫"))
                .flat_map(|p| {
                    p.get("stars")
                        .and_then(Value::as_array)
                        .map(|stars| {
                            stars
                                .iter()
                                .filter(|s| s.get("type").and_then(Value::as_str) == Some("major"))
                                .filter_map(|s| {
                                    s.get("name").and_then(Value::as_str).map(String::from)
                                })
                                .collect::<Vec<_>>()
                        })
                        .unwrap_or_default()
                })
                .collect()
        })
        .unwrap_or_default()
}

/// 合盘 system：人设 + 方法论 + 双方夫妻宫主星断语 + 四化断语
fn heming_system(a: &Value, b: &Value) -> String {
    let mut s = String::from(PERSONA);
    s.push_str("\n");
    s.push_str(&today_line());
    s.push_str("你正在做双人合盘分析。以下是合盘方法论：\n\n");
    s.push_str(HEMING_METHODOLOGY);
    s.push_str("\n\n");
    s.push_str(SIHUA_IN_FUQI);

    let mut seen: Vec<String> = Vec::new();
    for chart in [a, b] {
        for star in fuqi_majors(chart) {
            if let Some(block) = star_fuqi_block(&star) {
                if !seen.iter().any(|s| *s == star) {
                    seen.push(star.clone());
                    s.push('\n');
                    s.push_str(block);
                    s.push('\n');
                }
            }
        }
    }
    s
}

/// 合盘：[system, user(双盘事实+问题), ...history]
pub fn build_heming_messages(
    a: &Value,
    b: &Value,
    question: Option<&str>,
    history: &[ChatMsg],
) -> Vec<ChatMsg> {
    let system = heming_system(a, b);
    let mut user = String::from("【甲方命盘】\n");
    user.push_str(&chart_text(a));
    user.push_str("\n【乙方命盘】\n");
    user.push_str(&chart_text(b));
    if let Some(q) = question {
        if !q.trim().is_empty() {
            user.push_str("\n\n【分析要求】\n");
            user.push_str(q.trim());
            user.push('\n');
        }
    }
    let mut msgs = vec![ChatMsg::system(system), ChatMsg::user(user)];
    msgs.extend_from_slice(history);
    msgs
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn chart_with_fuqi(stars: Value) -> Value {
        json!({
            "birthInfo": { "year": 1990, "month": 5, "day": 9, "hour": 6, "gender": "female" },
            "mingGongBranch": 4,
            "palaces": [
                { "branch": 6, "stem": 0, "name": "夫妻宫", "stars": stars },
            ],
        })
    }

    #[test]
    fn interpret_topic_contains_persona_and_template() {
        let chart = chart_with_fuqi(json!([]));
        let msgs = build_interpret_messages(
            &chart,
            &[],
            Some(&InterpretIntent::Topic { topic: TopicKey::Love }),
            &[],
        )
        .unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, "system");
        assert!(msgs[0].content.contains("倪海厦《天纪》"));
        assert!(msgs[0].content.contains("夫妻宫"));
        assert_eq!(msgs[1].role, "user");
        assert!(msgs[1].content.starts_with("请深度分析感情婚姻运"));
        assert!(msgs[1].content.contains("**【夫妻宫分析】**"));
    }

    #[test]
    fn interpret_palace_and_sihua_and_free() {
        let chart = chart_with_fuqi(json!([{ "name": "天机", "type": "major" }]));
        let msgs = build_interpret_messages(
            &chart,
            &[],
            Some(&InterpretIntent::Palace { branch: 6 }),
            &[],
        )
        .unwrap();
        assert!(msgs[1].content.contains("请重点分析【夫妻宫】（主管：感情关系、婚姻状态）"));
        assert!(msgs[1].content.contains("该宫主星为天机"));

        let msgs = build_interpret_messages(
            &chart,
            &[],
            Some(&InterpretIntent::Sihua {
                star_name: "天机".into(),
                si_hua: "忌".into(),
                view: TimeView::Daxian,
            }),
            &[],
        )
        .unwrap();
        assert!(msgs[1].content.contains("请分析【大限天机化忌】的飞化影响"));
        assert!(msgs[1].content.contains("落在【夫妻宫】"));

        // 自由问答：不追加 user，问题在 history
        let history = vec![ChatMsg::user("我的财运如何？")];
        let msgs =
            build_interpret_messages(&chart, &[], None, &history).unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[1].content, "我的财运如何？");

        // 不存在的星/宫 → Err
        assert!(build_interpret_messages(
            &chart,
            &[],
            Some(&InterpretIntent::Palace { branch: 11 }),
            &[]
        )
        .is_err());
        assert!(build_interpret_messages(
            &chart,
            &[],
            Some(&InterpretIntent::Sihua {
                star_name: "紫微".into(),
                si_hua: "禄".into(),
                view: TimeView::Liunian,
            }),
            &[]
        )
        .is_err());
    }

    #[test]
    fn interpret_system_carries_chart_facts_and_patterns() {
        let chart = chart_with_fuqi(json!([]));
        let patterns = vec![json!({
            "name": "机月同梁", "level": "good", "description": "机月同梁作吏人",
        })];
        let msgs =
            build_interpret_messages(&chart, &patterns, None, &[]).unwrap();
        assert!(msgs[0].content.contains("【命盘数据】"));
        assert!(msgs[0].content.contains("公历 1990年5月9日"));
        assert!(msgs[0].content.contains("【已识别格局】"));
        assert!(msgs[0].content.contains("机月同梁（good）"));
        // 当前日期必须注入，否则模型会按训练语料年份误答"今年"
        assert!(msgs[0].content.contains("今日公历："));
        assert_eq!(
            today_line(),
            format!(
                "今日公历：{}。涉及“今年 / 当前年份 / 流年 / 当下”时一律以此日期为准，禁止自行推测年份。\n\n",
                chrono::Local::now().format("%Y-%m-%d")
            )
        );
    }

    #[test]
    fn heming_includes_methodology_and_only_relevant_star_entries() {
        let a = chart_with_fuqi(json!([{ "name": "紫微", "type": "major" }]));
        let b = chart_with_fuqi(json!([{ "name": "贪狼", "type": "major" }]));
        let msgs = build_heming_messages(&a, &b, Some("两人适合结婚吗"), &[]);
        let sys = &msgs[0].content;
        assert!(sys.contains("合盘分析核心框架"));
        assert!(sys.contains("一定要同时看福德宫"));
        assert!(sys.contains("今日公历："));
        assert!(sys.contains("【紫微入夫妻宫】"));
        // 双方夫妻宫主星各注入一条，去重后两条都在
        assert!(sys.contains("【贪狼入夫妻宫】"));
        let user = &msgs[1].content;
        assert!(user.contains("【甲方命盘】"));
        assert!(user.contains("【乙方命盘】"));
        assert!(user.contains("两人适合结婚吗"));
        assert_eq!(msgs.len(), 2);

        // 无主星 → 不注入任何断语条目
        let empty = chart_with_fuqi(json!([]));
        let msgs = build_heming_messages(&empty, &empty, None, &[]);
        assert!(!msgs[0].content.contains("入夫妻宫】"));
    }

    #[test]
    fn six_topic_templates_are_verbatim() {
        let chart = chart_with_fuqi(json!([]));
        for (topic, prefix) in [
            (TopicKey::Overview, "请生成命格总览"),
            (TopicKey::Love, "请深度分析感情婚姻运"),
            (TopicKey::Career, "请深度分析事业运"),
            (TopicKey::Wealth, "请深度分析财运"),
            (TopicKey::Health, "请分析健康运势"),
            (TopicKey::Personality, "请深度解析性格特质"),
        ] {
            let msgs = build_interpret_messages(
                &chart,
                &[],
                Some(&InterpretIntent::Topic { topic }),
                &[],
            )
            .unwrap();
            assert!(msgs[1].content.starts_with(prefix), "{prefix} 模板开头不符");
        }
    }
}
