//! 命盘 JSON → 确定性文本（同一输入恒得同一输出，快照单测钉住）。
//! 前端引擎的 ZiweiChart（lib/ziwei/types.ts）经 Tauri 序列化后在此渲染为
//! 供 LLM 阅读的结构化事实。只读取、不猜测：缺省字段安静跳过，畸形输入不 panic。

use serde_json::Value;

pub const BRANCHES: [&str; 12] = [
    "子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥",
];
pub const STEMS: [&str; 10] = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/// 12 宫主管领域（与原版 InsightPanel.PALACE_ROLES 逐字一致）
pub fn palace_role(name: &str) -> &'static str {
    match name {
        "命宫" => "自我、性格、先天格局",
        "兄弟宫" => "兄弟关系、合伙人",
        "夫妻宫" => "感情关系、婚姻状态",
        "子女宫" => "子女缘分、下属关系",
        "财帛宫" => "财运来源、收入方式",
        "疾厄宫" => "身体健康、意外",
        "迁移宫" => "外出机遇、人际格局",
        "交友宫" => "朋友圈、贵人、小人",
        "官禄宫" => "事业成就、社会地位",
        "田宅宫" => "不动产、家庭环境",
        "福德宫" => "精神享受、内心福分",
        "父母宫" => "父母关系、文书契约",
        _ => "",
    }
}

fn as_i64(v: &Value, key: &str) -> Option<i64> {
    v.get(key).and_then(Value::as_i64)
}

fn as_str<'a>(v: &'a Value, key: &str) -> Option<&'a str> {
    v.get(key).and_then(Value::as_str)
}

fn as_u32(v: &Value, key: &str) -> Option<u32> {
    v.get(key).and_then(Value::as_u64).and_then(|n| u32::try_from(n).ok())
}

fn idx_name(list: &[&'static str], i: Option<i64>) -> Option<&'static str> {
    let i = usize::try_from(i?).ok()?;
    list.get(i).copied()
}

/// 单颗星渲染：`紫微（庙）化禄`；无亮度/四化时省略对应部分
fn render_star(s: &Value) -> String {
    let name = as_str(s, "name").unwrap_or("?");
    let mut out = String::from(name);
    if let Some(b) = as_str(s, "brightnessRaw") {
        out.push_str(&format!("（{b}）"));
    }
    if let Some(h) = as_str(s, "siHua") {
        out.push_str(&format!("化{h}"));
    }
    out
}

/// 四化渲染：`禄{星} 权{星} 科{星} 忌{星}`（大限/流年四化对象为 {lu,quan,ke,ji} 星名）
fn render_sihua4(s: &Value) -> Option<String> {
    let get = |k: &str| as_str(s, k).unwrap_or("—");
    let lu = get("lu");
    let quan = get("quan");
    let ke = get("ke");
    let ji = get("ji");
    if lu == "—" && quan == "—" && ke == "—" && ji == "—" {
        return None;
    }
    Some(format!("禄{lu} 权{quan} 科{ke} 忌{ji}"))
}

/// 命盘 → 文本。palaces 按数组顺序（引擎保证按地支 0–11）逐宫渲染。
pub fn chart_text(chart: &Value) -> String {
    let mut out = String::new();
    out.push_str("【命盘数据】\n");

    // ── 出生信息 ──
    let birth = chart.get("birthInfo");
    let (year, month, day) = birth
        .map(|b| (as_i64(b, "year"), as_i64(b, "month"), as_i64(b, "day")))
        .unwrap_or((None, None, None));
    let hour = birth.and_then(|b| as_i64(b, "hour")).unwrap_or(0);
    let gender = match birth.and_then(|b| as_str(b, "gender")) {
        Some("female") => "女",
        _ => "男",
    };
    let hour_name = idx_name(&BRANCHES, Some(hour)).unwrap_or("?");
    out.push_str(&format!(
        "出生：公历 {}年{}月{}日 {}时（时辰序号 {}）\n",
        year.unwrap_or(0),
        month.unwrap_or(0),
        day.unwrap_or(0),
        hour_name,
        hour
    ));
    out.push_str(&format!("性别：{gender}\n"));
    if let Some(lon) = birth.and_then(|b| b.get("longitude")).and_then(Value::as_f64) {
        out.push_str(&format!("出生地经度：{lon}（已按真太阳时校正）\n"));
    }

    // ── 农历与四柱 ──
    if let Some(lunar) = chart.get("lunarInfo") {
        let ly = as_i64(lunar, "lunarYear");
        let lm = as_i64(lunar, "lunarMonth");
        let ld = as_i64(lunar, "lunarDay");
        let leap = lunar.get("isLeapMonth").and_then(Value::as_bool).unwrap_or(false);
        if let (Some(y), Some(m), Some(d)) = (ly, lm, ld) {
            out.push_str(&format!(
                "农历：{}年 {}{:02}月{:02}日\n",
                y,
                if leap { "闰" } else { "" },
                m.abs(),
                d
            ));
        }
        for (key, label) in [
            ("fourPillars", "四柱（节气口径）"),
            ("fourPillarsLunar", "四柱（农历口径）"),
        ] {
            if let Some(arr) = lunar.get(key).and_then(Value::as_array) {
                let joined: Vec<&str> = arr.iter().filter_map(Value::as_str).collect();
                if joined.len() == 4 {
                    out.push_str(&format!("{label}：{}\n", joined.join(" ")));
                }
            }
        }
    }

    // ── 命宫 / 身宫 / 命主 / 身主 / 阴阳 ──
    let ming_branch = as_i64(chart, "mingGongBranch");
    let shen_branch = as_i64(chart, "shenGongBranch");
    let palace_ganzhi = |branch: Option<i64>| -> String {
        let name = idx_name(&BRANCHES, branch).unwrap_or("?");
        format!("{name}宫")
    };
    out.push_str(&format!(
        "命宫：{}  身宫：{}\n",
        palace_ganzhi(ming_branch),
        palace_ganzhi(shen_branch)
    ));
    let mut extra = Vec::new();
    if let Some(v) = as_str(chart, "mingZhu") {
        extra.push(format!("命主 {v}"));
    }
    if let Some(v) = as_str(chart, "shenZhu") {
        extra.push(format!("身主 {v}"));
    }
    if let Some(v) = as_str(chart, "yinYangGender") {
        extra.push(v.to_string());
    }
    if !extra.is_empty() {
        out.push_str(&format!("{}\n", extra.join("  ")));
    }
    if let Some(ju) = as_str(chart, "wuxingJuName") {
        out.push_str(&format!("五行局：{ju}"));
        if let Some(pos) = as_i64(chart, "ziweiPos") {
            if let Some(name) = idx_name(&BRANCHES, Some(pos)) {
                out.push_str(&format!("  紫微落{name}宫"));
            }
        }
        out.push('\n');
    }

    // ── 十二宫 ──
    out.push_str("\n【十二宫】\n");
    if let Some(palaces) = chart.get("palaces").and_then(Value::as_array) {
        for p in palaces {
            let name = as_str(p, "name").unwrap_or("?");
            let branch = idx_name(&BRANCHES, as_i64(p, "branch")).unwrap_or("?");
            let stem = idx_name(&STEMS, as_i64(p, "stem")).unwrap_or("");
            out.push_str(&format!(
                "◆ {name}（{branch}{stem}{branch}）——主管：{}\n",
                palace_role(name)
            ));

            let stars = p.get("stars").and_then(Value::as_array);
            let by_type = |t: &str| -> Vec<String> {
                stars
                    .map(|arr| {
                        arr.iter()
                            .filter(|s| as_str(s, "type") == Some(t))
                            .map(|s| render_star(s))
                            .collect()
                    })
                    .unwrap_or_default()
            };
            for (t, label) in [
                ("major", "主星"),
                ("minor", "辅星"),
                ("lucky", "吉星"),
                ("sha", "煞星"),
            ] {
                let list = by_type(t);
                if !list.is_empty() {
                    out.push_str(&format!("  {label}：{}\n", list.join("、")));
                }
            }

            if p.get("isEmpty").and_then(Value::as_bool).unwrap_or(false) {
                let borrowed_name = as_str(p, "borrowedFromName").unwrap_or("对宫");
                let borrowed: Vec<&str> = p
                    .get("borrowedStars")
                    .and_then(Value::as_array)
                    .map(|a| a.iter().filter_map(Value::as_str).collect())
                    .unwrap_or_default();
                if borrowed.is_empty() {
                    out.push_str(&format!("  空宫（借{borrowed_name}主星）\n"));
                } else {
                    out.push_str(&format!(
                        "  空宫（借{borrowed_name}主星）：{}\n",
                        borrowed.join("、")
                    ));
                }
            }

            if let Some(self_marks) = p.get("selfSihua").and_then(Value::as_array) {
                let marks: Vec<String> = self_marks
                    .iter()
                    .filter_map(|m| {
                        let star = as_str(m, "starName")?;
                        let h = as_str(m, "siHua")?;
                        Some(format!("{star}{h}"))
                    })
                    .collect();
                if !marks.is_empty() {
                    out.push_str(&format!("  宫干自化：{}\n", marks.join("、")));
                }
            }

            if let Some(age) = p.get("daXianAge").and_then(Value::as_array) {
                let a = age.first().and_then(Value::as_i64).unwrap_or(0);
                let b = age.get(1).and_then(Value::as_i64).unwrap_or(0);
                let cur = p
                    .get("isCurrentDaXian")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);
                out.push_str(&format!(
                    "  大限：{a}–{b}岁{}\n",
                    if cur { "（当前大限）" } else { "" }
                ));
            }
        }
    }

    // ── 当前大限四化 ──
    let cur_idx = as_u32(chart, "currentDaXianIndex");
    if let (Some(daxians), Some(idx)) = (chart.get("daXians").and_then(Value::as_array), cur_idx) {
        if let Some(d) = daxians.get(idx as usize) {
            let a = as_i64(d, "startAge").unwrap_or(0);
            let b = as_i64(d, "endAge").unwrap_or(0);
            let name = as_str(d, "palaceName").unwrap_or("?");
            let stem = as_str(d, "stemName").unwrap_or("");
            let branch = idx_name(&BRANCHES, as_i64(d, "palaceBranch")).unwrap_or("?");
            out.push_str(&format!(
                "\n【当前大限】{a}–{b}岁 走{name}（{stem}{branch}）"
            ));
            if let Some(s4) = d.get("siHua").and_then(render_sihua4) {
                out.push_str(&format!(" 大限四化：{s4}"));
            }
            out.push('\n');
        }
    }

    out
}

/// 已识别格局 → 文本（patterns.ts 的 Pattern 结构）
pub fn patterns_text(patterns: &[Value]) -> String {
    if patterns.is_empty() {
        return String::new();
    }
    let mut out = String::from("\n【已识别格局】\n");
    for p in patterns {
        let name = as_str(p, "name").unwrap_or("?");
        let level = as_str(p, "level").unwrap_or("neutral");
        let desc = as_str(p, "description").unwrap_or("");
        out.push_str(&format!("- {name}（{level}）：{desc}"));
        if let Some(palaces) = p.get("palaces").and_then(Value::as_array) {
            let list: Vec<&str> = palaces.iter().filter_map(Value::as_str).collect();
            if !list.is_empty() {
                out.push_str(&format!("（涉及：{}）", list.join("、")));
            }
        }
        if let Some(src) = as_str(p, "source") {
            out.push_str(&format!(" 出处：{src}"));
        }
        out.push('\n');
    }
    out
}

/// 取某宫（按地支索引）的「宫名 + 主星带四化 + 主管领域」，
/// 与原版 InsightPanel 点宫位解读的构造一致；无主星时为「空宫（借对宫）」。
pub fn palace_focus(chart: &Value, branch: u8) -> Option<(String, String, &'static str)> {
    let palaces = chart.get("palaces").and_then(Value::as_array)?;
    let p = palaces.iter().find(|p| as_i64(p, "branch") == Some(branch as i64))?;
    let name = as_str(p, "name")?.to_string();
    let majors: Vec<String> = p
        .get("stars")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter(|s| as_str(s, "type") == Some("major"))
                .map(render_star)
                .collect()
        })
        .unwrap_or_default();
    let star_desc = if majors.is_empty() {
        "空宫（借对宫）".to_string()
    } else {
        majors.join("、")
    };
    let role = palace_role(&name);
    Some((name, star_desc, role))
}

/// 找星曜所在宫的宫名（四化点击模板用）
pub fn star_palace_name(chart: &Value, star_name: &str) -> Option<String> {
    let palaces = chart.get("palaces").and_then(Value::as_array)?;
    palaces
        .iter()
        .find(|p| {
            p.get("stars")
                .and_then(Value::as_array)
                .map(|arr| arr.iter().any(|s| as_str(s, "name") == Some(star_name)))
                .unwrap_or(false)
        })
        .and_then(|p| as_str(p, "name").map(|s| s.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// 构造 12 宫骨架，可对指定地支覆盖字段
    fn base_chart() -> Value {
        let mut palaces = Vec::new();
        for branch in 0..12i64 {
            palaces.push(json!({
                "branch": branch,
                "stem": branch % 10,
                "name": "?",
                "stars": [],
            }));
        }
        json!({
            "birthInfo": { "year": 1990, "month": 5, "day": 9, "hour": 6, "gender": "female", "longitude": 120 },
            "lunarInfo": {
                "lunarYear": 1990, "lunarMonth": 4, "lunarDay": 15,
                "yearStem": 6, "yearBranch": 6, "isLeapMonth": false,
                "fourPillars": ["庚午", "辛巳", "辛亥", "甲午"],
            },
            "mingGongBranch": 4, "shenGongBranch": 8,
            "wuxingJu": 3, "wuxingJuName": "木三局", "ziweiPos": 4,
            "palaces": palaces,
            "daXians": [{ "startAge": 6, "endAge": 15, "palaceBranch": 4, "palaceName": "命宫",
                          "stemName": "戊", "siHua": { "lu": "贪狼", "quan": "巨门", "ke": "太阴", "ji": "贪狼" } }],
            "currentAge": 36, "currentDaXianIndex": 0,
            "mingZhu": "贪狼", "shenZhu": "天相", "yinYangGender": "阴女",
        })
    }

    fn set_palace(chart: &mut Value, branch: i64, patch: Value) {
        let arr = chart.get_mut("palaces").unwrap().as_array_mut().unwrap();
        let slot = arr.iter_mut().find(|p| p["branch"] == branch).unwrap();
        let obj = slot.as_object_mut().unwrap();
        if let Value::Object(add) = patch {
            for (k, v) in add {
                obj.insert(k, v);
            }
        }
    }

    #[test]
    fn deterministic_and_core_lines() {
        let mut c = base_chart();
        set_palace(
            &mut c,
            4,
            json!({
                "name": "命宫",
                "stars": [
                    { "name": "紫微", "type": "major", "brightnessRaw": "庙", "siHua": "禄" },
                    { "name": "天府", "type": "major", "brightnessRaw": "旺" },
                    { "name": "擎羊", "type": "sha" },
                ],
            }),
        );
        set_palace(
            &mut c,
            5,
            json!({ "name": "兄弟宫", "isEmpty": true, "borrowedFromName": "夫妻宫", "borrowedStars": ["太阳", "太阴"] }),
        );
        set_palace(
            &mut c,
            8,
            json!({
                "name": "官禄宫",
                "selfSihua": [ { "siHua": "忌", "starName": "天机" } ],
                "daXianAge": [6, 15],
            }),
        );
        let t1 = chart_text(&c);
        let t2 = chart_text(&c);
        assert_eq!(t1, t2, "同一输入恒得同一输出");
        assert!(t1.contains("公历 1990年5月9日 午时（时辰序号 6）"));
        assert!(t1.contains("性别：女"));
        assert!(t1.contains("出生地经度：120"));
        assert!(t1.contains("农历：1990年 04月15日"));
        assert!(t1.contains("四柱（节气口径）：庚午 辛巳 辛亥 甲午"));
        assert!(t1.contains("命宫：辰宫  身宫：申宫"));
        assert!(t1.contains("命主 贪狼  身主 天相  阴女"));
        assert!(t1.contains("五行局：木三局  紫微落辰宫"));
        assert!(t1.contains("◆ 命宫（辰戊辰）——主管：自我、性格、先天格局"));
        assert!(t1.contains("主星：紫微（庙）化禄、天府（旺）"));
        assert!(t1.contains("煞星：擎羊"));
        assert!(t1.contains("空宫（借夫妻宫主星）：太阳、太阴"));
        assert!(t1.contains("宫干自化：天机忌"));
        assert!(t1.contains("大限：6–15岁"));
        assert!(t1.contains("【当前大限】6–15岁 走命宫（戊辰） 大限四化：禄贪狼 权巨门 科太阴 忌贪狼"));
    }

    #[test]
    fn missing_optional_fields_do_not_panic() {
        let c = json!({
            "birthInfo": { "year": 2000, "month": 1, "day": 1, "hour": 0, "gender": "male" },
            "palaces": [],
        });
        let t = chart_text(&c);
        assert!(t.contains("公历 2000年1月1日 子时"));
        assert!(t.contains("性别：男"));
        assert!(!t.contains("四柱"));
        assert!(!t.contains("五行局"));
    }

    #[test]
    fn patterns_text_formats_and_empty() {
        assert_eq!(patterns_text(&[]), "");
        let ps = vec![json!({
            "name": "紫府同宫", "level": "excellent",
            "description": "紫微天府同宫于寅申",
            "palaces": ["命宫"],
            "source": "《紫微斗数全书》",
        })];
        let t = patterns_text(&ps);
        assert!(t.contains("紫府同宫（excellent）：紫微天府同宫于寅申（涉及：命宫） 出处：《紫微斗数全书》"));
    }

    #[test]
    fn palace_focus_and_star_lookup() {
        let mut c = base_chart();
        set_palace(
            &mut c,
            6,
            json!({
                "name": "夫妻宫",
                "stars": [ { "name": "天机", "type": "major", "siHua": "忌" } ],
            }),
        );
        let (name, stars, role) = palace_focus(&c, 6).unwrap();
        assert_eq!(name, "夫妻宫");
        assert_eq!(stars, "天机化忌");
        assert_eq!(role, "感情关系、婚姻状态");
        assert_eq!(star_palace_name(&c, "天机").unwrap(), "夫妻宫");
        assert_eq!(star_palace_name(&c, "不存在"), None);
        // 空宫 → 「空宫（借对宫）」
        let (_, empty, _) = palace_focus(&c, 0).unwrap();
        assert_eq!(empty, "空宫（借对宫）");
    }
}
