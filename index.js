import readlineSync from 'readline-sync';
import OpenAI from 'openai';
import { getAllTodos,createTodo, searchTodo, deleteById } from './service.js';

const genAI = new OpenAI();

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
    Once you get the observations, Return the AI response based on START prompt and obsevations
    
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
    {"type": "plan", "plan": "I will try to get more context on what user needs to shop."}
    {"type": "output", "output": "Can you tell me what all items you want to shop for?"}
    {"type": "user", "user": "I want to shop for milk, bread and eggs"}
    {"type": "plan", "plan": "I will use createTodo to create new todo in Database'"}
    {"type": "action", "function": "createTodo", "input": "Shopping groceries with milk, bread and eggs"}
    {"type": "observation", "observation": "2"}
    {"type": "output", "output": "Your todo has been added susccessfully with id 2"}
`

const messages = [{
    role: 'system',
    content: SYSTEM_PROMPT
}]

// ✅ Chat Loop
async function chatWithGenAI() {
    while (true) {
        // Get user input
        const query = readlineSync.question('>>');
        const userMessage = {
            type: 'user',
            user: query,
        }
        messages.push({
            role: 'user',
            content: JSON.stringify(userMessage)
        })

        while (true) {
            const chat = await genAI.chat.completions.create({
                model: "gpt-4o-mini",
                messages: messages,
                response_format: { type: "json_object" }
            });
            const result = chat.choices[0].message.content;
            messages.push({
                role: 'assistant',
                content: result
            });

            const action = JSON.parse(result);

            if (action.type === 'output') {
                console.log(action.output);
                break;
            } else if (action.type === 'action') {
                const fn = tools[action.function];
                if (!fn) throw new Error("Invalid Tools calling");
                const observation = await fn(action.input);
                const observationMessage = {
                    type: 'observation',
                    observation
                }
                messages.push({
                    role: 'assistant',
                    content: JSON.stringify(observationMessage)
                })
            }
        }
    }
}

chatWithGenAI();