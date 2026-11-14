/* 영농일지 옮김 — 랜딩 (가설 B)
 * 하는 일: 아이콘 그리기 · 스크롤 등장 · 문의 폼 검증/전송 · 지표용 이벤트 기록
 *
 * 기록하는 이벤트 (가설 B 지표에 필요한 최소한)
 *   landing_view  방문 (세션당 1회)  → 지표 1의 분모: 랜딩 방문자
 *   cta_click     문의 버튼 클릭     → 어디서 눌렀는지(label)
 *   form_start    폼 첫 입력         → 폼 앞에서 이탈하는지 구분
 *   inquiry       문의 제출          → 지표 1의 분자: 문의 제출 수
 * 지표 2(우리 연락에 답해 대화한 사람)는 시트에서 담당자가 직접 표시합니다.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var cfg = Object.assign(
    { endpoint: "", contactWindow: "확인하는 대로" },
    window.SITE_CONFIG || {}
  );

  /* ---------- 작은 도우미 ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function cut(v, n) { return String(v == null ? "" : v).slice(0, n); }

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function read(kind, key) {
    try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; }
  }
  function write(kind, key, val) {
    try { var s = store(kind); if (s) s.setItem(key, val); } catch (e) { /* 저장소를 못 쓰는 환경은 무시 */ }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  /* ---------- 아이콘 ---------- */
  function drawIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") window.lucide.createIcons();
  }

  /* ---------- 방문자 · 유입 정보 (이름 없는 익명 값만) ---------- */
  var params = new URLSearchParams(location.search);
  var src = cut(params.get("src"), 40) || "direct";

  var vid = read("localStorage", "ilji_vid");
  if (!vid) { vid = uuid(); write("localStorage", "ilji_vid", vid); }

  function referrerHost() {
    try { return document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { return ""; }
  }

  function basePayload() {
    return {
      ts: new Date().toISOString(),
      src: src,
      vid: vid,
      utm_source: cut(params.get("utm_source"), 60),
      utm_medium: cut(params.get("utm_medium"), 60),
      utm_campaign: cut(params.get("utm_campaign"), 80),
      ref: referrerHost(),
      ua: cut(navigator.userAgent, 200)
    };
  }

  /* ---------- 전송 ---------- */
  function send(type, extra) {
    var payload = Object.assign(basePayload(), { type: type }, extra || {});

    if (!cfg.endpoint) {
      // 데모 모드: 어디에도 보내지 않고 이 브라우저에만 남겨 두어 눈으로 확인할 수 있게 한다.
      try {
        var log = JSON.parse(read("localStorage", "ilji_demo_log") || "[]");
        log.push(payload);
        write("localStorage", "ilji_demo_log", JSON.stringify(log.slice(-50)));
      } catch (e) { /* 무시 */ }
      if (window.console) console.info("[demo] " + type, payload);
      return Promise.resolve(true);
    }

    // Apps Script 웹 앱은 CORS 사전 요청(preflight)을 받지 않으므로 text/plain + no-cors 로 보낸다.
    return fetch(cfg.endpoint, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function () { return true; }, function () { return false; });
  }

  /* ---------- 방문 기록 (세션당 1회) ---------- */
  function trackView() {
    if (read("sessionStorage", "ilji_pv")) return;
    write("sessionStorage", "ilji_pv", "1");
    send("landing_view");
  }

  /* ---------- 데모 띠 ---------- */
  if (!cfg.endpoint) {
    var ribbon = $("#demo-ribbon");
    if (ribbon) ribbon.hidden = false;
  }

  /* ---------- 헤더 그림자 ---------- */
  var header = $(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 스크롤 등장 ---------- */
  var reveals = $all(".reveal");
  if ("IntersectionObserver" in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); revealIO.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    reveals.forEach(function (el) { revealIO.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- 모바일 하단 고정 버튼: 히어로 버튼·폼이 보일 땐 숨김 ---------- */
  var sticky = $("#sticky-cta");
  var heroCta = $("#hero-cta");
  var applySec = $(".form-card");
  if (sticky && heroCta && applySec && "IntersectionObserver" in window) {
    var heroSeen = true, formSeen = false;
    var update = function () {
      var show = !heroSeen && !formSeen;
      sticky.classList.toggle("is-visible", show);
      sticky.setAttribute("aria-hidden", show ? "false" : "true");
      var link = $("a", sticky);
      if (link) link.tabIndex = show ? 0 : -1;
    };
    new IntersectionObserver(function (e) { heroSeen = e[0].isIntersecting; update(); }).observe(heroCta);
    new IntersectionObserver(function (e) { formSeen = e[0].isIntersecting; update(); }, { threshold: 0 }).observe(applySec);
  }

  /* ---------- 버튼 클릭 기록 ---------- */
  $all("[data-cta]").forEach(function (el) {
    el.addEventListener("click", function () { send("cta_click", { label: el.getAttribute("data-cta") }); });
  });

  /* ---------- 폼 ---------- */
  var form = $("#inquiry");
  if (form) {
    var contactEl = $("#contact");
    var consentEl = $("#consent");
    var submitBtn = $("#submit-btn");
    var formError = $("#form-error");
    var started = false;
    var busy = false;

    form.addEventListener("focusin", function () {
      if (started) return;
      started = true;
      send("form_start");
    });

    function setError(field, msg) {
      var holder = field.closest ? field.closest(".field") : field;
      var out = $(".field__error", holder);
      if (out) out.textContent = msg || "";
      holder.classList.toggle("has-error", !!msg);
    }

    function validateContact(raw) {
      var v = raw.trim();
      if (!v) return "연락처를 적어 주세요.";
      var compact = v.replace(/[\s\-().]/g, "");
      if (/^\+?\d+$/.test(compact)) {
        var digits = compact.replace(/^\+82/, "0").replace(/\D/g, "");
        if (digits.length < 9 || digits.length > 11) return "전화번호를 다시 확인해 주세요. (예: 010-1234-5678)";
        return "";
      }
      // 카카오톡 ID: 4자 이상
      if (v.length < 4) return "카카오톡 ID는 4자 이상 적어 주세요.";
      return "";
    }

    contactEl.addEventListener("input", function () {
      if (contactEl.closest(".field").classList.contains("has-error")) setError(contactEl, validateContact(contactEl.value));
    });
    $all('input[name="journal"]').forEach(function (r) {
      r.addEventListener("change", function () { setError(r, ""); });
    });
    consentEl.addEventListener("change", function () { if (consentEl.checked) setError(consentEl, ""); });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (busy) return;

      formError.hidden = true;

      var contact = contactEl.value.trim();
      var journalEl = form.querySelector('input[name="journal"]:checked');
      var honey = form.elements["website"].value;

      var firstBad = null;
      var cErr = validateContact(contact);
      setError(contactEl, cErr);
      if (cErr) firstBad = firstBad || contactEl;

      var jErr = journalEl ? "" : "해당하는 것을 하나 골라 주세요.";
      setError($('input[name="journal"]'), jErr);
      if (jErr) firstBad = firstBad || $('input[name="journal"]');

      var kErr = consentEl.checked ? "" : "동의해 주셔야 문의를 보낼 수 있어요.";
      setError(consentEl, kErr);
      if (kErr) firstBad = firstBad || consentEl;

      if (firstBad) {
        firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
        if (firstBad === contactEl) contactEl.focus({ preventScroll: true });
        return;
      }

      // 봇이 숨은 칸을 채웠으면 성공한 척만 하고 보내지 않는다.
      if (honey) { showSuccess(); return; }

      busy = true;
      submitBtn.disabled = true;
      $(".btn__label", submitBtn).hidden = true;
      $(".btn__loading", submitBtn).hidden = false;

      send("inquiry", { contact: cut(contact, 40), journal: journalEl.value }).then(function (ok) {
        busy = false;
        submitBtn.disabled = false;
        $(".btn__label", submitBtn).hidden = false;
        $(".btn__loading", submitBtn).hidden = true;

        if (ok) {
          showSuccess();
        } else {
          formError.textContent = "보내지 못했어요. 인터넷 연결을 확인하고 한 번 더 눌러 주세요.";
          formError.hidden = false;
        }
      });
    });

    function showSuccess() {
      var box = $("#success");
      $("#success-text").textContent = "남겨 주신 연락처로 " + cfg.contactWindow + " 저희가 먼저 연락드릴게요.";
      form.hidden = true;
      box.hidden = false;
      drawIcons();
      box.scrollIntoView({ behavior: "smooth", block: "center" });
      box.focus({ preventScroll: true });
    }
  }

  /* ---------- 시작 ---------- */
  function init() {
    drawIcons();
    trackView();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
