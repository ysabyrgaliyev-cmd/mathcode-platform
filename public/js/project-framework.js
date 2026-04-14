// MathCode shared project framework (v2)
// Each project defines: PROJECT (meta), STEPS (array), CHALLENGES (array), and a renderStage(state) function.
// The framework handles: header, welcome modal, step progression, code panel, challenge, summary.

window.MC = (function () {
  const state = { step: 1, challengeIdx: 0, custom: {} };
  let PROJECT, STEPS, CHALLENGES, renderStage;

  const $ = id => document.getElementById(id);
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function colorize(t) {
    return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/(#[^<\n]*)$/g,'<span class="com">$1</span>')
      .replace(/\b(for|in|if|else|elif|while|return|range|print|def|and|or|not|import|from|as|True|False|None|lambda)\b/g,'<span class="kw">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g,'<span class="num">$1</span>')
      .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g,'<span class="str">$1</span>');
  }

  function renderHeader() {
    document.body.insertAdjacentHTML('afterbegin',
      `<header class="proj-header">
        <div class="proj-title">${PROJECT.icon} ${escape(PROJECT.title)}</div>
        <div class="proj-tools">
          <span class="step-pill" id="stepPill"></span>
          <button class="btn" id="btnHint">💡 Hint</button>
          <button class="btn" id="btnRestart">↻ Restart</button>
        </div>
      </header>`);
  }

  function renderWelcome() {
    document.body.insertAdjacentHTML('beforeend',
      `<div class="modal-bg" id="welcome">
        <div class="modal-card">
          <h1>${PROJECT.welcomeIcon || '👋'} ${escape(PROJECT.welcomeTitle)}</h1>
          <p>${PROJECT.welcomeBody}</p>
          <div class="you-will">
            <strong>You'll learn:</strong>
            <ul>${PROJECT.youWill.map(x => `<li>${x}</li>`).join('')}</ul>
          </div>
          <p style="font-size:13px;">⏱ ${PROJECT.duration} · ${PROJECT.gradeBand}</p>
          <button class="btn primary" id="btnStart" style="font-size:18px; padding:14px 28px;">Let's start! →</button>
        </div>
      </div>`);
  }

  function renderShell() {
    document.body.insertAdjacentHTML('beforeend',
      `<main class="proj-main">
        <aside class="lesson">
          <div class="progress-dots" id="dots"></div>
          <h2 id="stepTitle"></h2>
          <p class="sub" id="stepSub"></p>
          <div class="task" id="taskBox"></div>
          <details class="why"><summary>🤔 Why does this matter?</summary><p id="whyText"></p></details>
          <div class="check" id="checkBox"></div>
          <div class="hint-box" id="hintBox" style="display:none"></div>
          <div class="lesson-actions">
            <button class="btn" id="btnPrev" disabled>← Back</button>
            <button class="btn primary" id="btnNext" disabled>Next →</button>
          </div>
        </aside>
        <div class="stage-wrap">
          <div class="stage" id="stage"></div>
          <div class="code-panel">
            <div class="code-head">
              <span class="label">📝 Code (the computer is doing this)</span>
              <span class="label">${PROJECT.language}</span>
            </div>
            <pre class="code" id="codeBlock"></pre>
          </div>
        </div>
      </main>`);
  }

  function renderDots() {
    const d = $('dots'); d.innerHTML = '';
    for (let i = 1; i <= STEPS.length; i++) {
      const x = document.createElement('div');
      x.className = 'dot' + (i < state.step ? ' done' : i === state.step ? ' active' : '');
      d.appendChild(x);
    }
  }

  function renderCode() {
    const s = STEPS[state.step - 1]; const blk = $('codeBlock'); blk.innerHTML = '';
    for (const c of (s.code || [])) {
      const ln = document.createElement('span');
      ln.className = 'code-line' + (c.highlight ? ' hl' : '');
      ln.innerHTML = colorize(c.line) + (c.ann ? `<span class="annot"># ${escape(c.ann)}</span>` : '');
      blk.appendChild(ln);
    }
  }

  function renderStep() {
    const s = STEPS[state.step - 1];
    $('stepPill').textContent = `Step ${state.step} of ${STEPS.length}`;
    $('stepTitle').textContent = s.title;
    $('stepSub').textContent = s.sub;
    $('taskBox').innerHTML = s.task + (s.taskSub ? `<small>${s.taskSub}</small>` : '');
    $('whyText').textContent = s.why;
    $('hintBox').style.display = 'none';
    $('btnPrev').disabled = state.step === 1;
    renderDots(); renderCode();
    renderStage(state);
    refreshCheck();
    if (s.showChallenge) showChallenge(); else hideChallenge();
  }

  function refreshCheck() {
    const s = STEPS[state.step - 1]; const box = $('checkBox');
    const done = s.isDone(state);
    box.textContent = done ? '✓ Step complete! Click Next →' : s.check(state);
    box.className = 'check' + (done ? ' done' : '');
    $('btnNext').disabled = !done;
  }

  function nextStep() {
    if (state.step < STEPS.length) { state.step++; renderStep(); } else showSummary();
  }
  function prevStep() { if (state.step > 1) { state.step--; renderStep(); } }

  function showChallenge() {
    if ($('challengeBox')) return;
    const wrap = document.querySelector('.stage-wrap');
    const div = document.createElement('div'); div.id = 'challengeBox'; div.className = 'challenge';
    wrap.appendChild(div); renderChallenge();
  }
  function hideChallenge() { const c = $('challengeBox'); if (c) c.remove(); }

  function renderChallenge() {
    const div = $('challengeBox'); if (!div) return;
    if (state.challengeIdx >= CHALLENGES.length) {
      div.innerHTML = '<h3>🎉 All questions answered!</h3><p>Click Next → to see your summary.</p>';
      return;
    }
    const q = CHALLENGES[state.challengeIdx];
    div.innerHTML = `<h3>Question ${state.challengeIdx + 1} of ${CHALLENGES.length}</h3>
      <div class="qbox">${q.q}</div><div class="options"></div><div class="qfeedback" id="qfb"></div>`;
    const opts = div.querySelector('.options');
    q.options.forEach(o => {
      const b = document.createElement('button'); b.className = 'opt'; b.textContent = o;
      b.onclick = () => answer(o, b);
      opts.appendChild(b);
    });
  }

  function answer(picked, btn) {
    const q = CHALLENGES[state.challengeIdx]; const fb = $('qfb');
    if (String(picked) === String(q.answer)) {
      btn.classList.add('right'); fb.className = 'qfeedback right';
      fb.textContent = '✓ Correct! ' + q.why;
      state.challengeIdx++; setTimeout(renderChallenge, 1300); refreshCheck();
    } else {
      btn.classList.add('wrong'); fb.className = 'qfeedback wrong';
      fb.textContent = '✗ Try again. Hint: ' + q.why;
    }
  }

  function showSummary() {
    document.querySelector('main.proj-main').innerHTML = `<div></div>
      <div class="stage" style="grid-column:1/-1;flex-direction:column;">
        <div class="summary-card">
          <div class="badge">🏆</div>
          <h2>Great work! Project complete.</h2>
          <p style="color:var(--ink-soft);">You finished ${escape(PROJECT.title)}. Here's what you learned:</p>
          <ul class="you-learned">${PROJECT.youLearned.map(x => `<li>${x}</li>`).join('')}</ul>
          <p style="color:var(--ink-soft);margin:14px 0;">${PROJECT.upNext || ''}</p>
          <button class="btn primary" onclick="location.reload()">Restart project</button>
        </div></div>`;
    $('stepPill').textContent = `Done!`;
  }

  function init(opts) {
    PROJECT = opts.project; STEPS = opts.steps;
    CHALLENGES = opts.challenges || []; renderStage = opts.renderStage || (() => {});
    if (opts.initState) Object.assign(state.custom, opts.initState);
    document.title = `${PROJECT.title} — MathCode`;
    renderHeader(); renderShell(); renderWelcome();
    $('btnStart').onclick = () => $('welcome').style.display = 'none';
    $('btnNext').onclick = nextStep;
    $('btnPrev').onclick = prevStep;
    $('btnRestart').onclick = () => location.reload();
    $('btnHint').onclick = () => {
      const s = STEPS[state.step - 1]; const hb = $('hintBox');
      hb.textContent = '💡 ' + (s.hint || 'Just keep trying!'); hb.style.display = 'block';
    };
    renderStep();
  }

  return { init, state, refresh: refreshCheck, $, escape };
})();
