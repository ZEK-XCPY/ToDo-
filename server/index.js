import 'dotenv/config';
import bcrypt from 'bcryptjs';
import MongoStore from 'connect-mongo';
import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';

const app = express();
const port = Number(process.env.PORT || 5000);
const sessionSecret = process.env.SESSION_SECRET;
const priorities = ['low', 'medium', 'high'];

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set.');
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters.');
}

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, minlength: 3, maxlength: 30 },
  passwordHash: { type: String, required: true },
}, { timestamps: true });

const taskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 200 },
  description: { type: String, default: '', maxlength: 2000 },
  priority: { type: String, enum: priorities, default: 'medium' },
  dueDate: { type: Date, default: null },
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

taskSchema.index({ user: 1, order: 1 });

const User = mongoose.model('User', userSchema);
const Task = mongoose.model('Task', taskSchema);

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use(session({
  name: 'daymark.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions' }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 14 * 24 * 60 * 60 * 1000,
  },
}));

function sendError(res, status, message) {
  return res.status(status).json({ error: { message } });
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireUser(req, res, next) {
  if (!req.session.userId) return sendError(res, 401, 'Please sign in to continue.');
  next();
}

function normalizedUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validDate(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? undefined
    : parsed;
}

function taskJson(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() || null,
    completed: task.completed,
    createdAt: task.createdAt,
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function taskSort(sort) {
  if (sort === 'created-desc') return { createdAt: -1, _id: -1 };
  if (sort === 'created') return { createdAt: 1, _id: 1 };
  return { order: 1, createdAt: 1, _id: 1 };
}

function sortByDueDate(tasks) {
  return tasks.sort((left, right) => {
    if (!left.dueDate) return right.dueDate ? 1 : left.order - right.order;
    if (!right.dueDate) return -1;
    return left.dueDate - right.dueDate || left.order - right.order;
  });
}

function taskFields(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Provide task details as a JSON object.' };
  }
  const allowed = new Set(['title', 'description', 'priority', 'dueDate', 'completed']);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    return { error: 'One or more task fields are not supported.' };
  }

  const values = {};
  if (creating || Object.hasOwn(body, 'title')) {
    if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) {
      return { error: 'Task name must be between 1 and 200 characters.' };
    }
    values.title = body.title.trim();
  }
  if (Object.hasOwn(body, 'description') || creating) {
    if (body.description !== undefined && typeof body.description !== 'string') {
      return { error: 'Task details must be text.' };
    }
    values.description = (body.description || '').trim();
    if (values.description.length > 2000) return { error: 'Task details must be 2000 characters or fewer.' };
  }
  if (Object.hasOwn(body, 'priority') || creating) {
    values.priority = body.priority ?? 'medium';
    if (!priorities.includes(values.priority)) return { error: 'Choose low, medium, or high priority.' };
  }
  if (Object.hasOwn(body, 'dueDate') || creating) {
    values.dueDate = body.dueDate === undefined ? null : validDate(body.dueDate);
    if (values.dueDate === undefined) return { error: 'Due date must be a valid calendar date.' };
  }
  if (Object.hasOwn(body, 'completed')) {
    if (typeof body.completed !== 'boolean') return { error: 'Task status must be complete or active.' };
    values.completed = body.completed;
  }
  if (!creating && Object.keys(values).length === 0) return { error: 'Provide at least one task field to update.' };
  return { values };
}

function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.userId = user._id.toString();
      req.session.save((saveError) => (saveError ? reject(saveError) : resolve()));
    });
  });
}

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const username = normalizedUsername(req.body?.username);
  const password = req.body?.password;
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) {
    return sendError(res, 400, 'Username must be 3 to 30 characters using letters, numbers, dots, underscores, or hyphens.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return sendError(res, 400, 'Password must be between 8 and 128 characters.');
  }
  const user = await User.create({ username, passwordHash: await bcrypt.hash(password, 12) });
  await establishSession(req, user);
  res.status(201).json({ user: { username: user.username } });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = normalizedUsername(req.body?.username);
  const password = req.body?.password;
  const user = await User.findOne({ username });
  if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
    return sendError(res, 401, 'Username or password is incorrect.');
  }
  await establishSession(req, user);
  res.json({ user: { username: user.username } });
}));

app.get('/api/auth/me', requireUser, asyncRoute(async (req, res) => {
  const user = await User.findById(req.session.userId).select('username');
  if (!user) {
    req.session.destroy(() => {});
    return sendError(res, 401, 'Please sign in to continue.');
  }
  res.json({ user: { username: user.username } });
}));

app.post('/api/auth/logout', (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('daymark.sid', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    res.status(204).end();
  });
});

app.get('/api/todos', requireUser, asyncRoute(async (req, res) => {
  const { status = 'all', priority = 'all', q = '', sort = 'manual' } = req.query;
  if (!['all', 'active', 'completed'].includes(status)
    || !['all', ...priorities].includes(priority)
    || !['manual', 'created-desc', 'created', 'dueDate', 'priority'].includes(sort)
    || typeof q !== 'string' || q.length > 200) {
    return sendError(res, 400, 'One or more task filters are invalid.');
  }

  const ownerId = new mongoose.Types.ObjectId(req.session.userId);
  const filter = { user: ownerId };
  if (status !== 'all') filter.completed = status === 'completed';
  if (priority !== 'all') filter.priority = priority;
  if (q.trim()) {
    const expression = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ title: expression }, { description: expression }];
  }
  const [tasks, all, completed] = await Promise.all([
    Task.find(filter).sort(sort === 'dueDate' ? { order: 1 } : taskSort(sort)).lean(),
    Task.countDocuments({ user: ownerId }),
    Task.countDocuments({ user: ownerId, completed: true }),
  ]);
  if (sort === 'dueDate') sortByDueDate(tasks);
  if (sort === 'priority') tasks.sort((left, right) => priorities.indexOf(right.priority) - priorities.indexOf(left.priority) || left.order - right.order);
  res.json({
    todos: tasks.map(taskJson),
    counts: { all, active: all - completed, completed },
  });
}));

app.post('/api/todos', requireUser, asyncRoute(async (req, res) => {
  const { values, error } = taskFields(req.body, true);
  if (error) return sendError(res, 400, error);
  const lastTask = await Task.findOne({ user: req.session.userId }).sort({ order: -1 }).select('order').lean();
  const task = await Task.create({ ...values, user: req.session.userId, order: (lastTask?.order ?? -1) + 1 });
  res.status(201).json({ todo: taskJson(task) });
}));

app.patch('/api/todos/reorder', requireUser, asyncRoute(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id))) {
    return sendError(res, 400, 'Provide the complete task order as a list of task IDs.');
  }
  const existing = await Task.find({ user: req.session.userId }).select('_id').lean();
  const existingIds = existing.map((task) => task._id.toString());
  if (ids.length !== existingIds.length || new Set(ids).size !== ids.length
    || ids.some((id) => !existingIds.includes(id))) {
    return sendError(res, 400, 'Task order must include each of your tasks exactly once.');
  }
  if (ids.length) {
    await Task.bulkWrite(ids.map((id, order) => ({
      updateOne: { filter: { _id: id, user: req.session.userId }, update: { $set: { order } } },
    })));
  }
  res.status(204).end();
}));

app.patch('/api/todos/:id', requireUser, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, 'Task not found.');
  const { values, error } = taskFields(req.body);
  if (error) return sendError(res, 400, error);
  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, user: req.session.userId },
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!task) return sendError(res, 404, 'Task not found.');
  res.json({ todo: taskJson(task) });
}));

app.delete('/api/todos/:id', requireUser, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return sendError(res, 404, 'Task not found.');
  const result = await Task.deleteOne({ _id: req.params.id, user: req.session.userId });
  if (!result.deletedCount) return sendError(res, 404, 'Task not found.');
  res.status(204).end();
}));

app.use('/api', (req, res) => sendError(res, 404, 'API route not found.'));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return sendError(res, 409, 'That username is already taken.');
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return sendError(res, 400, 'Request body must be valid JSON.');
  }
  console.error(error);
  return sendError(res, 500, 'Something went wrong. Please try again.');
});

await mongoose.connect(process.env.MONGODB_URI);
app.listen(port, () => console.log(`Daymark API listening on port ${port}`));