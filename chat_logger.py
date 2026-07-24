import os
import json

CHAT_LOG_PATH = "chat_log.json"

def save_chat(question, answer):
    log = {"question": question, "answer": answer}
    with open(CHAT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(log) + "\n")


def load_history():
    history = []
    if os.path.exists(CHAT_LOG_PATH):
        with open(CHAT_LOG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    chat = json.loads(line)
                    history.append(chat)
                except json.JSONDecodeError:
                    continue
    return history

def clear_history():
    """Delete all saved chat history."""
    if os.path.exists(CHAT_LOG_PATH):
        os.remove(CHAT_LOG_PATH)
