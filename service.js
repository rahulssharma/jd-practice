import { ilike, eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { todosTable } from './db/schema.js';

export async function getAllTodos() {
    console.log("Getting all todos");
    const todos = await db.select().from(todosTable);
    return todos;
}

export async function createTodo(todo) {
    console.log("Creating todo", todo);
    const [res] = await db.insert(todosTable).values({
        todo,
    }).returning({ id: todosTable.id });
    return res.id;
}

export async function searchTodo(search) {
    console.log("Searching todo", search);
    const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, `%${search}%`));
    return todos;
}

export async function deleteById(id) {
    console.log("Deleting todo", id);
    await db.delete(todosTable).where(eq(todosTable.id, id))
}