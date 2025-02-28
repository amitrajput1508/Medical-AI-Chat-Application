import re
import requests
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Your API Key (consider using an environment variable for security)
OPENROUTER_API_KEY = "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"

modelR1 = "deepseek/deepseek-r1:free"
modelV1 = "deepseek/deepseek-chat:free"
model7B = "mistralai/mistral-7b-instruct:free"
model70B = "deepseek/deepseek-r1-distill-llama-70b:free"

@app.route('/')
def index():
    return send_file("index.html")

def checkCondition(query, model):
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": f"Query: {query}. Is this query related to the medical field or not? Answer in one word."}]
            },
        )
        response_json = response.json()
        return response_json["choices"][0]["message"]["content"].strip().lower()
    except Exception as e:
        print(f"Error in checkCondition: {e}")
        return "error"

def checkQuery(condition):
    pattern = r"\b(yes|no)\b"
    matches = re.findall(pattern, condition, re.IGNORECASE)
    return matches[0].lower() if matches else "no"

def gen_response(query, model):
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": query}]
            },
        )
        response_json = response.json()
        return response_json["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Error in gen_response: {e}")
        return "I'm sorry, I couldn't generate a response."

def gen_followups(query, model):
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": model,
                "messages": [{
                    "role": "user",
                    "content": f"Given the medical condition described: '{query}', generate 5 relevant diagnostic follow-up questions. The questions should help identify the cause of the issue. Format the response as:\n1. <question>\n2. <question>\n3. <question>\n4. <question>\n5. <question>"
                }]
            },
        )
        return response.json()["choices"][0]["message"]["content"].strip().split('\n')
    except Exception as e:
        print(f"Error in gen_followups: {e}")
        return []

def mergeFollowupsResponse(followups, responses):
    context = ''
    idx = 1
    for f, r in zip(followups, responses):
        context += f"Followup {idx}: {f.split('.')[-1].strip()}, Response {idx}: {r}\n"
        idx += 1
    return context

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    query = data.get("query", "").strip()

    if not query:
        return jsonify({"error": "No query provided"}), 400

    condition = checkCondition(query, model7B)

    if condition == "error":
        return jsonify({"error": "Error processing your query."}), 500

    if checkQuery(condition) == "yes":
        response_text = gen_response(query, model7B)
        followups = gen_followups(query, model7B)
        return jsonify({"response": response_text, "followups": followups})
    else:
        return jsonify({"response": "I am sorry, I can only respond to medical-related queries!"})

@app.route('/answer', methods=['POST'])
def answer():
    data = request.json
    followups = data.get("followups", [])
    responses = data.get("responses", [])

    if not followups or not responses:
        return jsonify({"error": "Missing follow-up questions or responses."}), 400

    context = mergeFollowupsResponse(followups, responses)
    final_solution = gen_response(f"Based on these responses, provide the best diagnosis and medical advice. {context}", model7B)

    return jsonify({"final_solution": final_solution})

if __name__ == '__main__':
    app.run(debug=True, port=5001)
