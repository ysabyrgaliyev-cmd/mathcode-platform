// MathCode v2 — shared engine for type-and-run Python projects
// Each project defines: window.PROJECT = { STEPS, onStepChange?, onReset?, initialState? }

(function(){
  const state = window.MC_STATE = { step: 0, ranThisStep: false, completed: [], blanks: {}, custom: {} };

  // ====== Mini Python interpreter ======
  // Supports: assignment, arithmetic, print, for-in-range, if/else, def simple, list literals, math.sin/cos/sqrt/pi
  function runPython(code, initialVars) {
    const out = [];
    const vars = Object.assign({ math: { sin: Math.sin, cos: Math.cos, sqrt: Math.sqrt, pi: Math.PI, pow: Math.pow, floor: Math.floor, ceil: Math.ceil, abs: Math.abs } }, initialVars || {});
    const lines = code.split('\n').map(l => ({ raw: l, indent: l.match(/^(\s*)/)[1].length, body: l.trim() })).filter(l => l.body && !l.body.startsWith('#'));

    function evalExpr(expr) {
      // Translate Python-isms to JS
      let js = expr
        .replace(/\bTrue\b/g, 'true')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bNone\b/g, 'null')
        .replace(/\band\b/g, '&&')
        .replace(/\bor\b/g, '||')
        .replace(/\bnot\b/g, '!');
      const keys = Object.keys(vars);
      const vals = keys.map(k => vars[k]);
      return Function(...keys, `return (${js})`)(...vals);
    }

    function execBlock(startIdx, parentIndent) {
      let idx = startIdx;
      while (idx < lines.length && lines[idx].indent > parentIndent) {
        const line = lines[idx];
        const body = line.body;

        if (/^print\s*\(/.test(body)) {
          const inner = body.match(/^print\s*\(([\s\S]*)\)\s*$/)[1];
          const parts = splitTopLevel(inner);
          const evaled = parts.map(p => {
            p = p.trim();
            if (/^"[^"]*"$/.test(p) || /^'[^']*'$/.test(p)) return p.slice(1, -1);
            try {
              const v = evalExpr(p);
              return typeof v === 'number' ? (Number.isInteger(v) ? v : Math.round(v * 1000) / 1000) : v;
            } catch { return p; }
          });
          out.push(evaled.join(' '));
          idx++;
        }
        else if (/^for\s+(\w+)\s+in\s+range\s*\(\s*(.+?)\s*\)\s*:/.test(body)) {
          const m = body.match(/^for\s+(\w+)\s+in\s+range\s*\(\s*(.+?)\s*\)\s*:/);
          const v = m[1]; const args = splitTopLevel(m[2]).map(s => evalExpr(s.trim()));
          let start = 0, end = 0, step = 1;
          if (args.length === 1) end = args[0];
          else if (args.length === 2) { start = args[0]; end = args[1]; }
          else { start = args[0]; end = args[1]; step = args[2]; }
          const loopStart = idx + 1;
          const loopIndent = line.indent;
          let endIdx = loopStart;
          while (endIdx < lines.length && lines[endIdx].indent > loopIndent) endIdx++;
          for (let k = start; (step > 0 ? k < end : k > end); k += step) {
            vars[v] = k;
            execBlock(loopStart, loopIndent);
          }
          idx = endIdx;
        }
        else if (/^for\s+(\w+)\s+in\s+(.+?)\s*:/.test(body)) {
          const m = body.match(/^for\s+(\w+)\s+in\s+(.+?)\s*:/);
          const v = m[1]; const iter = evalExpr(m[2]);
          const loopStart = idx + 1, loopIndent = line.indent;
          let endIdx = loopStart;
          while (endIdx < lines.length && lines[endIdx].indent > loopIndent) endIdx++;
          for (const item of iter) { vars[v] = item; execBlock(loopStart, loopIndent); }
          idx = endIdx;
        }
        else if (/^if\s+(.+?)\s*:/.test(body)) {
          const cond = body.match(/^if\s+(.+?)\s*:/)[1];
          const truthy = evalExpr(cond);
          const blockStart = idx + 1, blockIndent = line.indent;
          let endIdx = blockStart;
          while (endIdx < lines.length && lines[endIdx].indent > blockIndent) endIdx++;
          if (truthy) execBlock(blockStart, blockIndent);
          // handle else
          if (endIdx < lines.length && lines[endIdx].indent === blockIndent && /^else\s*:/.test(lines[endIdx].body)) {
            const elseStart = endIdx + 1;
            let elseEnd = elseStart;
            while (elseEnd < lines.length && lines[elseEnd].indent > blockIndent) elseEnd++;
            if (!truthy) execBlock(elseStart, blockIndent);
            idx = elseEnd;
          } else {
            idx = endIdx;
          }
        }
        else if (/^def\s+(\w+)\s*\((.*?)\)\s*:/.test(body)) {
          const m = body.match(/^def\s+(\w+)\s*\((.*?)\)\s*:/);
          const fname = m[1]; const params = m[2].split(',').map(s => s.trim()).filter(Boolean);
          const defStart = idx + 1, defIndent = line.indent;
          let endIdx = defStart;
          while (endIdx < lines.length && lines[endIdx].indent > defIndent) endIdx++;
          const bodyLines = lines.slice(defStart, endIdx);
          vars[fname] = function(...args) {
            const saved = {};
            params.forEach((p, i) => { saved[p] = vars[p]; vars[p] = args[i]; });
            let retVal;
            for (const bl of bodyLines) {
              const rm = bl.body.match(/^return\s+(.+)$/);
              if (rm) { retVal = evalExpr(rm[1]); break; }
            }
            params.forEach(p => vars[p] = saved[p]);
            return retVal;
          };
          idx = endIdx;
        }
        else if (/^(\w+)\s*=\s*(.+)$/.test(body) && !/^(\w+)\s*==/.test(body)) {
          const m = body.match(/^(\w+)\s*=\s*(.+)$/);
          vars[m[1]] = evalExpr(m[2]);
          idx++;
        }
        else {
          idx++;
        }
      }
    }
    execBlock(0, -1);
    return { vars, out };
  }

  function splitTopLevel(s) {
    const parts = [];
    let depth = 0, cur = '', inStr = false, strCh = '';
    for (const c of s) {
      if (inStr) { cur += c; if (c === strCh) inStr = false; continue; }
      if (c === '"' || c === "'") { inStr = true; strCh = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur) parts.push(cur);
    return parts;
  }

  // ====== Rendering ======
  function renderLesson() {
    const STEPS = window.PROJECT.STEPS;
    const s = STEPS[state.step];
    const el = document.getElementById('lesson');
    const dots = STEPS.map((_, i) => `<div class="dot ${i === state.step ? 'active' : (state.completed[i] ? 'done' : '')}"></div>`).join('');
    const advanceOk = s.canAdvance ? s.canAdvance(state) : state.ranThisStep;
    const isLast = s.isLast;
    el.innerHTML = `
      <div class="step-no">Step ${state.step + 1} of ${STEPS.length}</div>
      <h2>${s.title}</h2>
      <div class="sub">${s.sub || ''}</div>
      <div class="task">${s.task}<span class="ts">${s.taskSub || ''}</span></div>
      <div class="why">${s.why}</div>
      <button class="hint-btn" onclick="document.getElementById('hintBox').classList.toggle('on')">💡 Need a hint?</button>
      <div class="hint-box" id="hintBox">${s.hint || ''}</div>
      <div class="nav">
        ${state.step > 0 ? '<button class="btn" onclick="MC.goPrev()">← Back</button>' : ''}
        <button class="btn primary" onclick="MC.goNext()" ${advanceOk ? '' : 'disabled'}>${isLast && advanceOk ? '🏆 Finish' : 'Next →'}</button>
        <div class="dots">${dots}</div>
      </div>
      ${advanceOk ? `<div style="background:#dcfce7;color:#166534;padding:8px 12px;border-radius:8px;margin-top:10px;font-size:13px;font-weight:700;text-align:center">${s.advanceMessage || '✓ Great job!'}</div>` : ''}
    `;
    renderCode();
  }

  function renderCode() {
    const s = window.PROJECT.STEPS[state.step];
    const area = document.getElementById('codeArea');
    let html = '';
    s.code.forEach((line, i) => {
      let inner = colorize(line.txt);
      if (line.blank) {
        const cur = state.blanks['s'+state.step+'_b'+line.blank.idx] || '';
        const valid = s.blanks[line.blank.idx].validator(cur);
        const cls = cur === '' ? '' : (valid ? 'ok' : 'bad');
        inner += `<input class="blank ${cls}" id="blank_${line.blank.idx}" style="width:${line.blank.width}px" value="${escape(cur)}" oninput="MC.onBlankInput(${line.blank.idx})">`;
      }
      if (line.suffix) inner += colorize(line.suffix);
      html += `<div class="line"><span class="ln">${i+1}</span><span class="code-line">${inner}</span></div>`;
    });
    area.innerHTML = html;
    document.getElementById('runBtn').disabled = !blanksValid();
  }

  function colorize(txt) {
    return escape(txt)
      .replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;)/g, '<span class="str">$1</span>')
      .replace(/("[^"]*"|'[^']*')/g, '<span class="str">$1</span>')
      .replace(/\b(for|in|if|else|elif|while|def|return|True|False|None|and|or|not)\b/g, '<span class="kw">$1</span>')
      .replace(/\b(print|range|len|input|int|str|float|sum|abs)\b/g, '<span class="fn">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span class="num">$1</span>');
  }

  function escape(s) { return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function blanksValid() {
    const s = window.PROJECT.STEPS[state.step];
    if (!s.blanks || !s.blanks.length) return true;
    return s.blanks.every((b, i) => b.validator(state.blanks['s'+state.step+'_b'+i] || ''));
  }

  function assembleCode() {
    const s = window.PROJECT.STEPS[state.step];
    return s.code.map(line => {
      let txt = line.txt;
      if (line.blank) txt += (state.blanks['s'+state.step+'_b'+line.blank.idx] || '');
      if (line.suffix) txt += line.suffix;
      return txt;
    }).join('\n');
  }

  // ====== Public API ======
  window.MC = {
    state,
    runPython,
    onBlankInput(idx) {
      const inp = document.getElementById('blank_'+idx);
      state.blanks['s'+state.step+'_b'+idx] = inp.value;
      const s = window.PROJECT.STEPS[state.step];
      const valid = s.blanks[idx].validator(inp.value);
      inp.classList.toggle('ok', valid);
      inp.classList.toggle('bad', !valid && inp.value.length > 0);
      document.getElementById('runBtn').disabled = !blanksValid();
    },
    goNext() {
      const STEPS = window.PROJECT.STEPS;
      state.completed[state.step] = true;
      if (STEPS[state.step].isLast) { showSummary(); return; }
      state.step++;
      state.ranThisStep = false;
      document.getElementById('console').innerHTML = '';
      document.getElementById('runStatus').textContent = '';
      if (window.PROJECT.onStepChange) window.PROJECT.onStepChange(state.step, state);
      renderLesson();
    },
    goPrev() {
      if (state.step > 0) state.step--;
      state.ranThisStep = false;
      renderLesson();
    },
    renderLesson,
    celebrate() {
      const stage = document.getElementById('stage');
      const c = document.createElement('div');
      c.className = 'celebration';
      c.textContent = '🎉';
      stage.appendChild(c);
      setTimeout(() => c.remove(), 1300);
    }
  };

  function showSummary() {
    document.querySelector('.shell').style.display = 'none';
    const summary = document.createElement('div');
    summary.className = 'summary';
    summary.innerHTML = window.PROJECT.summary || `
      <div class="ic">🏆</div>
      <h2>Project Complete!</h2>
      <p>You wrote real Python code to solve a math problem.</p>
    `;
    document.querySelector('.app').appendChild(summary);
  }

  // ====== Boot ======
  function boot() {
    if (window.PROJECT.initialState) Object.assign(state.custom, window.PROJECT.initialState);

    const runBtn = document.getElementById('runBtn');
    runBtn.addEventListener('click', () => {
      const s = window.PROJECT.STEPS[state.step];
      const code = assembleCode();
      const con = document.getElementById('console');
      con.innerHTML = '';
      document.getElementById('runStatus').textContent = 'Running...';
      try {
        const initial = s.getInitialVars ? s.getInitialVars(state) : {};
        const { vars, out } = runPython(code, initial);
        out.forEach(o => {
          const div = document.createElement('div');
          div.className = 'out';
          div.textContent = '› ' + o;
          con.appendChild(div);
        });
        document.getElementById('runStatus').textContent = '✓ Ran successfully';
        state.ranThisStep = true;
        if (s.onRun) s.onRun(vars, state);
        setTimeout(() => renderLesson(), 100);
      } catch (e) {
        const div = document.createElement('div');
        div.className = 'out err';
        div.textContent = '✗ Error: ' + e.message;
        con.appendChild(div);
        document.getElementById('runStatus').textContent = '✗ Error';
      }
    });

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (window.PROJECT.onReset) window.PROJECT.onReset(state);
      state.ranThisStep = false;
      document.getElementById('console').innerHTML = '';
      document.getElementById('runStatus').textContent = '';
      renderLesson();
    });

    renderLesson();
    if (window.PROJECT.onStepChange) window.PROJECT.onStepChange(0, state);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
