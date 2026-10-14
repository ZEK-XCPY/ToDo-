# MERN To-Do App Requirements

## 1. Project overview

Build a simple web app that helps people keep track of their personal tasks. A signed-in user can create tasks, organize them, and mark them as complete. Each user's tasks must remain private.

## 2. Technology

- **MongoDB** stores user accounts and tasks.
- **Express.js** provides the server and API.
- **React** provides the user interface.
- **Node.js** runs the server.

## 3. Users

The app is for people who want a straightforward way to manage their own to-do list. Each person uses an account to access their tasks.

## 4. Functional requirements

### Accounts

- A new user can sign up with a username and password.
- A registered user can log in and log out.
- The app remembers the signed-in user between page visits.
- A user can only view and change their own tasks.

### Tasks

- A user can create a task with a required title.
- A task can also have a description, a due date, and a priority: low, medium, or high.
- A user can view their tasks and see whether each task is active or complete.
- A user can edit a task, mark it complete or active, and delete it.
- A user can change the order of tasks.
- A user can filter tasks by status or priority, search task titles and descriptions, and sort the list.

## 5. Main screens

- **Sign up:** username and password form.
- **Log in:** username and password form.
- **My Tasks:** task list, task creation form, search, filters, and sorting.
- **Edit Task:** form for changing a task's title, description, priority, or due date.

## 6. Basic user flow

1. A new user creates an account, or an existing user logs in.
2. The app opens the user's task list.
3. The user adds a task and optionally sets its description, priority, and due date.
4. The user can update, reorder, search, or filter tasks as needed.
5. The user marks finished tasks complete or deletes tasks they no longer need.
6. The user logs out when finished.

## 7. Quality requirements

- The interface should be simple to understand and work on desktop and mobile screens.
- Task and account data should be saved in MongoDB and remain available after refreshing the page.
- Passwords must not be stored as plain text.
- Forms should explain missing or invalid information in clear language.
- The app should show a helpful message when an operation fails.

## 8. Out of scope for the first version

- Sharing tasks with other users.
- Team workspaces or collaboration.
- File attachments, reminders, or notifications.
- Native mobile applications.

## 9. Completion checklist

The first version is ready when a user can create an account, log in, and manage their own tasks; task changes persist after a refresh; and one user cannot access another user's tasks.
