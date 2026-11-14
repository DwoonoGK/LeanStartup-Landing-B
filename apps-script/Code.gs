/**
 * 문의 폼 · 방문 기록 수신기 (Google Apps Script)
 *
 * 구글 시트에 'events'(방문·클릭·폼 시작)와 'inquiries'(문의) 두 탭을 자동으로 만들고,
 * 'summary' 탭에서 가설 B의 지표를 바로 볼 수 있게 한다.
 *
 * 설치 방법은 README.md 의 "폼 연결"을 따른다.
 */

var EVENTS_SHEET = "events";
var INQUIRIES_SHEET = "inquiries";
var SUMMARY_SHEET = "summary";

// events 탭 열: A 시각 · B type · C src · D 방문자ID · E label · F utm_source · G utm_medium · H utm_campaign · I 유입 사이트 · J 기기
var EVENTS_HEADER = ["시각", "type", "src", "방문자ID", "label", "utm_source", "utm_medium", "utm_campaign", "유입 사이트", "기기"];

// inquiries 탭 열: A 접수시각 · B src · C 방문자ID · D 연락처 · E 일지 방식 · F 연락 시도 · G 답변함 · H 대화함 · I 메모 · J 기기
// F~I 는 담당자가 직접 채운다. F·G·H 는 "O" 로 표시하면 summary 에 집계된다.
var INQUIRIES_HEADER = ["접수시각", "src", "방문자ID", "연락처", "일지 방식", "연락 시도(O)", "답변함(O)", "대화함(O)", "메모", "기기"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (d.type === "inquiry") {
      var inq = sheet_(ss, INQUIRIES_SHEET, INQUIRIES_HEADER);
      inq.appendRow([
        d.ts, d.src, d.vid, d.contact, d.journal,
        "", "", "", "", d.ua
      ].map(safe_));
    } else if (["landing_view", "cta_click", "form_start"].indexOf(d.type) !== -1) {
      var ev = sheet_(ss, EVENTS_SHEET, EVENTS_HEADER);
      ev.appendRow([
        d.ts, d.type, d.src, d.vid, d.label || "",
        d.utm_source || "", d.utm_medium || "", d.utm_campaign || "",
        d.ref || "", d.ua
      ].map(safe_));
    }
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error");
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return ContentService.createTextOutput("ok");
}

/** 탭이 없으면 만들고, 머리글 행을 넣는다. */
function sheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#e6f0e8");
  }
  return sh;
}

/** 시트 수식으로 오해되는 값(=, +, -, @ 로 시작)은 앞에 ' 를 붙여 글자로 저장한다. */
function safe_(v) {
  var s = String(v == null ? "" : v).slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/**
 * 한 번만 실행: 3개 탭과 summary 지표를 만든다.
 * (Apps Script 편집기에서 setup 을 선택하고 ▶ 실행)
 */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(ss, EVENTS_SHEET, EVENTS_HEADER);
  sheet_(ss, INQUIRIES_SHEET, INQUIRIES_HEADER);

  var sm = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET, 0);
  sm.clear();

  var rows = [
    ["가설 B 지표", "값", "설명"],
    ["랜딩 방문자 (명)", '=IFERROR(COUNTUNIQUE(FILTER(events!D2:D, events!B2:B="landing_view", events!C2:C="B")), 0)', "src=B 로 들어온 방문자 수 (브라우저 기준)"],
    ["문의 제출 (명)", '=COUNTIFS(inquiries!B2:B, "B")', "지표 1 — 랜딩 방문자 중 문의를 제출한 사람 수"],
    ["우리 연락에 답함 (명)", '=COUNTIFS(inquiries!B2:B, "B", inquiries!G2:G, "O")', "inquiries 의 '답변함(O)' 에 O 로 표시된 수"],
    ["대화까지 감 (명)", '=COUNTIFS(inquiries!B2:B, "B", inquiries!H2:H, "O")', "지표 2 — 문의자 중 우리 연락에 답해 대화한 사람 수"],
    ["광고비 (원)", "", "← 직접 입력: 소재 B 에 쓴 광고비"],
    ["문의 1건당 광고비 (원)", '=IF(B3=0, "-", ROUND(B6/B3))', "지표 3"]
  ];
  sm.getRange(1, 1, rows.length, 3).setValues(rows); // '=' 로 시작하는 값은 수식으로 들어간다.
  sm.getRange("A1:C1").setFontWeight("bold").setBackground("#e6f0e8");
  sm.getRange("B6").setBackground("#fbefd9");
  sm.setColumnWidth(1, 200);
  sm.setColumnWidth(2, 120);
  sm.setColumnWidth(3, 420);
}
