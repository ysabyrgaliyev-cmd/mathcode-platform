// db/init.js — Initialize the SQLite database schema and seed projects
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'mathcode.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student',  -- 'student' | 'teacher' | 'admin'
  grade_level   INTEGER,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
  id           TEXT PRIMARY KEY,                -- e.g. 't1-p1'
  tier         INTEGER NOT NULL,                -- 1 | 2 | 3
  ordinal      INTEGER NOT NULL,                -- order within tier
  title        TEXT NOT NULL,
  subtitle     TEXT NOT NULL,
  grade_band   TEXT NOT NULL,                   -- 'K-3', '4-7', '8-12'
  language     TEXT NOT NULL,                   -- 'Scratch', 'Python+Scratch', 'Python'
  math_topics  TEXT NOT NULL,
  cs_topics    TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  difficulty   INTEGER NOT NULL,                -- 1-5
  file_path    TEXT NOT NULL,                   -- relative path to embeddable HTML
  description  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  project_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed'
  score       INTEGER,                              -- 0-100 if applicable
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(user_id, project_id)
);

CREATE TABLE IF NOT EXISTS sessions_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  project_id TEXT,
  event      TEXT NOT NULL,
  metadata   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_project ON progress(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions_log(user_id);
`);

// Seed projects (the 12 prototypes already built)
const projects = [
  // ---- TIER 1: K-3 ----
  { id:'t1-p1', tier:1, ordinal:1, title:'Number Quest',
    subtitle:'Counting, addition, subtraction with friendly creatures',
    grade_band:'K-3', language:'Scratch', math_topics:'Counting, +/-, Number sense',
    cs_topics:'Sequencing, loops, simple events', duration_min:35, difficulty:1,
    file_path:'projects/MathCode_Tier1_Project1_NumberQuest.html',
    description:'Learners help a creature collect numbers while practicing counting and addition. Introduces sequencing and loops by repeating a movement command.' },
  { id:'t1-p2', tier:1, ordinal:2, title:'Fraction Feast',
    subtitle:'Fractions made tangible with food slices',
    grade_band:'K-3', language:'Scratch', math_topics:'Halves, thirds, fourths, equivalence',
    cs_topics:'Variables, conditionals', duration_min:40, difficulty:2,
    file_path:'projects/MathCode_Tier1_Project2_FractionFeast.html',
    description:'Students slice virtual pizzas and pies to learn fractions concretely. Conditionals branch on whether the slice is fair.' },
  { id:'t1-p3', tier:1, ordinal:3, title:'Shape Builder',
    subtitle:'Geometry with click-to-build polygons',
    grade_band:'K-3', language:'Scratch', math_topics:'2D shapes, sides, vertices, symmetry',
    cs_topics:'Loops, parameters', duration_min:35, difficulty:2,
    file_path:'projects/MathCode_Tier1_Project3_ShapeBuilder.html',
    description:'Learners construct polygons by setting side count and length, seeing how loops draw shapes.' },
  { id:'t1-p4', tier:1, ordinal:4, title:'Pattern Machine',
    subtitle:'Sequences and pattern recognition',
    grade_band:'K-3', language:'Scratch', math_topics:'Patterns, sequences, predict-next',
    cs_topics:'Functions/blocks, abstraction', duration_min:40, difficulty:3,
    file_path:'projects/MathCode_Tier1_Project4_PatternMachine.html',
    description:'Students program a machine that produces visual and numeric patterns. Reinforces abstraction by extracting a rule from examples.' },

  { id:'t1-p5', tier:1, ordinal:5, title:'Treasure Takeaway',
    subtitle:'Subtraction with a pirate treasure theme',
    grade_band:'K-3', language:'Python', math_topics:'Subtraction, taking away, comparing',
    cs_topics:'Variables, loops, if/else', duration_min:30, difficulty:1,
    file_path:'projects/MathCode_Tier1_Project5_TreasureTakeaway.html',
    description:'Captain Cody found treasure! Students subtract gems using variables, loops, and if-statements to track what\'s left.' },
  { id:'t1-p6', tier:1, ordinal:6, title:'Number Showdown',
    subtitle:'Compare numbers in an arena battle',
    grade_band:'K-3', language:'Python', math_topics:'Greater than, less than, equal to',
    cs_topics:'Comparison operators, if/else', duration_min:25, difficulty:1,
    file_path:'projects/MathCode_Tier1_Project6_NumberShowdown.html',
    description:'Dragon vs Lion! Students use >, <, and == to compare numbers and decide who wins each round.' },
  { id:'t1-p7', tier:1, ordinal:7, title:'Place Value City',
    subtitle:'Build numbers with tens and ones blocks',
    grade_band:'K-3', language:'Python', math_topics:'Place value, tens, ones, // and %',
    cs_topics:'Arithmetic operators, loops', duration_min:30, difficulty:2,
    file_path:'projects/MathCode_Tier1_Project7_PlaceValueCity.html',
    description:'Builder Bot constructs numbers using blue ten-rods and yellow one-cubes. Students learn // and % to split numbers apart.' },
  { id:'t1-p8', tier:1, ordinal:8, title:'Skip Count Safari',
    subtitle:'Count by 2s, 5s, and 10s on safari',
    grade_band:'K-3', language:'Python', math_topics:'Skip counting, multiplication basics',
    cs_topics:'range(start, stop, step), loops', duration_min:30, difficulty:2,
    file_path:'projects/MathCode_Tier1_Project8_SkipCountSafari.html',
    description:'Ranger Riley spots animal groups! Students use range() with a step parameter to skip count and discover the connection to multiplication.' },
  { id:'t1-p9', tier:1, ordinal:9, title:'Addition Station',
    subtitle:'Add passengers on the MathCode Express',
    grade_band:'K-3', language:'Python', math_topics:'Multi-number addition, sum(), word problems',
    cs_topics:'Lists, loops, sum()', duration_min:35, difficulty:2,
    file_path:'projects/MathCode_Tier1_Project9_AdditionStation.html',
    description:'The MathCode Express picks up passengers at each stop. Students add numbers, use lists and sum(), and solve a word problem.' },

  // ---- TIER 2: 4-7 ----
  { id:'t2-p1', tier:2, ordinal:1, title:'Ratio Lab',
    subtitle:'Ratios and proportions through scalable recipes',
    grade_band:'4-7', language:'Python+Scratch', math_topics:'Ratios, proportions, unit rates',
    cs_topics:'Variables, arithmetic, list iteration', duration_min:50, difficulty:3,
    file_path:'projects/MathCode_Tier2_Project1_RatioLab.html',
    description:'Students scale a recipe up or down by manipulating ratios. The code panel shows how multiplication preserves proportion.' },
  { id:'t2-p2', tier:2, ordinal:2, title:'Algebra Quest',
    subtitle:'Solve for x using a balance-scale visualization',
    grade_band:'4-7', language:'Python+Scratch', math_topics:'Linear equations, inverse operations',
    cs_topics:'Conditionals, loops, debugging', duration_min:55, difficulty:3,
    file_path:'projects/MathCode_Tier2_Project2_AlgebraQuest.html',
    description:'A balance scale UI lets students isolate a variable. The code panel mirrors each move as an inverse operation.' },
  { id:'t2-p3', tier:2, ordinal:3, title:'Coordinate Plotter',
    subtitle:'Coordinate geometry with click-and-plot',
    grade_band:'4-7', language:'Python+Scratch', math_topics:'Coordinate plane, slope, distance',
    cs_topics:'Functions, data structures (lists/tuples)', duration_min:50, difficulty:3,
    file_path:'projects/MathCode_Tier2_Project3_CoordinatePlotter.html',
    description:'Students plot points, draw line segments, and compute slope/distance with formulas mirrored in code.' },
  { id:'t2-p4', tier:2, ordinal:4, title:'Probability Lab',
    subtitle:'Empirical probability through dice and spinners',
    grade_band:'4-7', language:'Python+Scratch', math_topics:'Probability, sample space, frequencies',
    cs_topics:'Random, simulation, loops', duration_min:55, difficulty:4,
    file_path:'projects/MathCode_Tier2_Project4_ProbabilityLab.html',
    description:'Students run dice and spinner simulations and watch empirical probability converge to theoretical as N grows.' },

  // ---- TIER 3: 8-12 ----
  { id:'t3-p1', tier:3, ordinal:1, title:'Function Lab',
    subtitle:'Linear, quadratic, exponential function explorer',
    grade_band:'8-12', language:'Python', math_topics:'Functions, transformations, families',
    cs_topics:'Numpy, Matplotlib, parameter sweeps', duration_min:65, difficulty:4,
    file_path:'projects/MathCode_Tier3_Project1_FunctionLab.html',
    description:'Students manipulate function parameters and observe transformations live. Code panel uses NumPy-style vectorization.' },
  { id:'t3-p2', tier:3, ordinal:2, title:'Trig Waves',
    subtitle:'Sinusoidal waveform parameter studio',
    grade_band:'8-12', language:'Python', math_topics:'sin, cos, tan; amplitude, period, phase',
    cs_topics:'Numpy, animation loops', duration_min:65, difficulty:4,
    file_path:'projects/MathCode_Tier3_Project2_TrigWaves.html',
    description:'Sliders for A, B, C, D in y = A·sin(B(x−C))+D. Animates and overlays multiple waves. 8-question challenge set.' },
  { id:'t3-p3', tier:3, ordinal:3, title:'Stat Lab',
    subtitle:'Histograms, boxplots, and outlier detection',
    grade_band:'8-12', language:'Python', math_topics:'Mean, median, IQR, outliers, distributions',
    cs_topics:'Pandas-style data ops, Box-Muller', duration_min:70, difficulty:4,
    file_path:'projects/MathCode_Tier3_Project3_StatLab.html',
    description:'Four real-world datasets plus a normal-distribution generator. Students see how outliers shift mean vs. median.' },
  { id:'t3-p4', tier:3, ordinal:4, title:'Calculus Explorer',
    subtitle:'Derivatives and Riemann sums interactively',
    grade_band:'8-12', language:'Python', math_topics:'Tangent lines, derivatives, integrals',
    cs_topics:'Numerical methods, limits as h→0', duration_min:75, difficulty:5,
    file_path:'projects/MathCode_Tier3_Project4_CalculusExplorer.html',
    description:'Dual-mode tool: secant→tangent visualization and Left/Right/Mid Riemann sums. 7 functions, 8 challenges.' }
];

const insert = db.prepare(`
  INSERT INTO projects (id, tier, ordinal, title, subtitle, grade_band, language,
    math_topics, cs_topics, duration_min, difficulty, file_path, description)
  VALUES (@id, @tier, @ordinal, @title, @subtitle, @grade_band, @language,
    @math_topics, @cs_topics, @duration_min, @difficulty, @file_path, @description)
  ON CONFLICT(id) DO UPDATE SET
    title=excluded.title, subtitle=excluded.subtitle, grade_band=excluded.grade_band,
    language=excluded.language, math_topics=excluded.math_topics, cs_topics=excluded.cs_topics,
    duration_min=excluded.duration_min, difficulty=excluded.difficulty,
    file_path=excluded.file_path, description=excluded.description
`);
const seed = db.transaction((rows) => { for (const r of rows) insert.run(r); });
seed(projects);

// Seed a demo teacher and demo students if no users exist
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, full_name, role, grade_level)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertUser.run('teacher@mathcode.local', hash('teacher123'),
                 'Demo Teacher', 'teacher', null);
  insertUser.run('student@mathcode.local', hash('student123'),
                 'Demo Student', 'student', 5);
  console.log('Seeded demo users:');
  console.log('  teacher@mathcode.local / teacher123');
  console.log('  student@mathcode.local / student123');
}

console.log(`Database ready at ${dbPath}`);
console.log(`Projects seeded: ${projects.length}`);
db.close();
