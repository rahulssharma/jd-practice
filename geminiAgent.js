import { ilike } from 'drizzle-orm';
import { db } from './db/index.js';
import { todosTable } from './db/schema.js';
import Gemini from 'gemini-ai';
import readlineSync from 'readline-sync';
import { GoogleGenerativeAI } from '@google/generative-ai';


// const client = new Gemini(API_KEY);
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
// const chat = gemini.createChat();
// TOOLs

async function getAllTodos() {
    console.log("Getting all todos");
    const todos = await db.query().from(todosTable);
    return todos;
}

async function createTodo(todo) {
    console.log("Creating todo", todo);
    const [res] = await db.insert(todosTable).values({
        todo,
    }).returning({ id: todosTable.id });
    return res.id;
}

async function searchTodo(search) {
    console.log("Searching todo", search);
    const todos = await db.select().from(todosTable).where(ilike(todosTable.todo, search))
    return todos;
}

async function deleteById(id) {
    console.log("Deleting todo", id);
    await db.delete(todosTable).where(todosTable.id.eq(id))
}

const tools = {
    getAllTodos,
    createTodo,
    searchTodo,
    deleteById
}

const SYSTEM_PROMPT = `
    You are an AI To-Do List Assistant, with START, PLAN, ACTION, Observation and Output state,
    Wait for the user prompt and first PLAN using available tools.
    After Planning, Take the action with appropriate tools and wait for Observation based on Action.
    Once you get the observations, Return the AI response based on START promt and obsevations
    
    You can manage tasks by adding, viewing, updating and deleting tasks.
    You must strictly follow the JSON output format.

    Todo DB Schema:
    id: Int and Primary Key
    todo: String
    created_at: Date Time
    updated_at: Date Time

    Available tools:
    - getAllTodos() : returns all todos from Database
    - createTodo(todo: string) : creates a new todo in the Database and takes todo as a string and returns the id of created todo
    - searchTodo(search: string) : searches for all todos matching the query string using ilike in db
    - deleteById(id: string) : delete todo by id given in the Database

    Example:
    START
    {"type": "user", "user": "Add a task for shoping groceries"}
    {"type": "plan", "plan": "I will use createTodo to create new todo in Database'"}
    {"type": "action", "function": "createTodo", "input": "Shopping groceries"}
    {"type": "observation", "observation": "2"}
    {"type": "output", "output": "Your todo has been added susccessfully with id 2"}

    ---
// ### Example JSON Responses:

// #### ✅ Valid Output Example:
// {"type": "output", "output": "Your task has been added successfully"}

// #### ❌ Invalid Responses (DO NOT RETURN):
// ✅ "Your task has been added successfully." ❌ (Wrong: Not JSON)
// ✅ **{"type": "output", "output": "Your task has been added"}** ❌ (Wrong: No JSON wrapping)

// ---
// FAILURE TO FOLLOW THESE RULES WILL RESULT IN AN ERROR.
`

const messages = [{
    role: 'user',
    parts: [{ text: SYSTEM_PROMPT }]
}]

// ✅ Chat Loop
async function chatWithGemini() {
    while (true) {
        // Get user input
        const query = readlineSync.question('>>');
        messages.push({ role: "user", parts: [{ text: JSON.stringify({ type: "user", user: query }) }] });


        // while (true) {
        // Initialize Chat Model
        const client = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const chat = await client.startChat({
            history: messages,
            generationConfig: { response_mime_type: "application/json" }
        });

        // Send message & get response
        const response = await chat.sendMessage("Continue conversation");
        const result = response.response.text();

        console.log("Gemini's Response:", result);

        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("No valid JSON found in response.");
            }
            const action = JSON.parse(jsonMatch[0]); // Parse only the JSON part
            // const action = JSON.parse(result);
            // Store assistant response
            messages.push({ role: "model", parts: [{ text: result }] });

            // Handle output
            if (action.type === "output") {
                // console.log(`Result: ${action.output}`);
                // console.log(` ${action.output}`);
                break;
            }

            // Handle function calls
            if (action.type === "action") {
                const func = tools[action.function];
                if (!func) throw new Error(`Function ${action.function} not found in tools`);

                const observation = await func(action.input);
                messages.push({
                    role: "function",
                    parts: [{ text: JSON.stringify({ type: "observation", observation }) }]
                });
            }
        } catch (error) {
            console.error("Error parsing response:", error);
        }
    }
    // }
}

// ✅ Start the chatbot
chatWithGemini();
