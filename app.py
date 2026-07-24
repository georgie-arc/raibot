import os
import re
import json
import time
import requests
import streamlit as st
import base64
from dotenv import load_dotenv
from chat_logger import save_chat, load_history, clear_history

# ── Page setup ────────────────────────────────────────────────
st.set_page_config(page_title="RAI‑Buddy", page_icon="◆", layout="centered")
load_dotenv()

with open("styles.css", "r", encoding="utf-8") as f:
    st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

MODELS = ["gemma:2b", "mistral", "llama2:7b-chat"]
def get_base64_image(path):
    with open(path, "rb") as img:
        return base64.b64encode(img.read()).decode()

logo_base64 = get_base64_image("KMITL-Logo.png")


@st.cache_resource(show_spinner=False)
def get_ollama_endpoint():
    return os.getenv("OLLAMA_API", "http://localhost:11434")


def ollama_is_reachable():
    try:
        r = requests.get(f"{get_ollama_endpoint()}/api/tags", timeout=2)
        return r.status_code == 200
    except requests.exceptions.RequestException:
        return False


def stream_reply(prompt, model, placeholder):
    """Stream tokens from Ollama straight into the placeholder bubble."""
    url = f"{get_ollama_endpoint()}/api/generate"
    payload = {"model": model, "prompt": prompt}
    full_text = ""
    try:
        with requests.post(url, json=payload, stream=True, timeout=120) as resp:
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama API error {resp.status_code}: {resp.text}")
            for line in resp.iter_lines():
                if not line:
                    continue
                chunk = json.loads(line)
                full_text += chunk.get("response", "")
                placeholder.markdown(
                    f'<div class="chat-bubble bot-bubble">{full_text}▍</div>',
                    unsafe_allow_html=True,
                )
        placeholder.markdown(
            f'<div class="chat-bubble bot-bubble">{full_text}</div>',
            unsafe_allow_html=True,
        )
        return full_text.strip()
    except requests.exceptions.RequestException as exc:
        raise RuntimeError(f"Network error contacting Ollama: {exc}") from exc


def extract_city(query):
    match = re.search(r'\b(?:in|at|for)\s+([A-Za-z\s]+)', query, re.IGNORECASE)
    if match:
        return match.group(1).strip().title()
    words = query.split()
    common_weather_words = ['weather', 'forecast', 'in', 'at', 'for', 'today', 'like']
    possible_city = [w for w in words if w.lower() not in common_weather_words]
    if possible_city:
        return possible_city[-1].title()
    return "Surat"


def get_weather_report(city="Surat"):
    api_key = os.getenv("WEATHER_API_KEY")
    if not api_key:
        return "Weather service is not configured yet. Add WEATHER_API_KEY to your .env file.", True
    url = f"https://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code != 200:
            return f"Couldn't fetch weather info (HTTP {resp.status_code}).", True
        data = resp.json()
        return (
            f"WEATHER — {city.upper()}\n"
            f"Feels like   {data['main']['feels_like']}°C\n"
            f"Temperature  {data['main']['temp']}°C\n"
            f"Condition    {data['weather'][0]['description'].capitalize()}\n"
            f"Humidity     {data['main']['humidity']}%\n"
            f"Wind         {data['wind']['speed']} m/s"
        ), False
    except Exception as e:
        return f"Error fetching weather data: {e}", True


# ── Sidebar: control panel ────────────────────────────────────
with st.sidebar:
    st.markdown("### Control Panel")
    model_choice = st.selectbox("Model", MODELS, index=0)
    st.markdown("---")
    st.markdown("Session")
    col_a, col_b = st.columns(2, gap="small")
    with col_a:
        if st.button("History", key="save_history", use_container_width=True):
            st.rerun()
    with col_b:
        if st.button("Clear", key="clear_button", use_container_width=True):
            clear_history()
            st.rerun()

# ── Masthead ───────────────────────────────────────────────────
connected = ollama_is_reachable()
status_label = "model online" if connected else "model offline"
st.markdown(
    f"""
<div class="rai-mark">
    <img src="data:image/png;base64,{logo_base64}" class="rai-logo">
</div>
            <div>
                <div class="rai-wordmark">RAI‑BUDDY</div>
                <div class="rai-subtitle">local · private · on-device</div>
            </div>
        </div>
        <div class="rai-status">
            <span class="rai-dot" style="background:{'#5eead4' if connected else '#e8677a'};
                  box-shadow:0 0 0 3px {'rgba(94,234,212,.14)' if connected else 'rgba(232,103,122,.14)'};"></span>
            {status_label} · {model_choice}
        </div>
    </div>
    """,
    unsafe_allow_html=True,
)

# ── Transcript ─────────────────────────────────────────────────
history = load_history()

if not history:
    st.markdown(
        """
        <div class="rai-empty">
            <h3>Ask anything</h3>
            <p>RAI‑Buddy runs entirely on your machine. Ask a question 
            ".</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

for chat in history:
    st.markdown(
        f"""
        <div class="rai-row user">
            <div class="rai-avatar user">YOU</div>
            <div class="rai-bubble-wrap">
                <div class="chat-bubble user-bubble">{chat["question"]}</div>
            </div>
        </div>
        <div class="rai-row bot">
            <div class="rai-avatar bot">RAI</div>
            <div class="rai-bubble-wrap">
                <div class="chat-bubble bot-bubble">{chat["answer"]}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

# ── Input ────────────────────────────────────────────────────
user_query = st.chat_input("Ask anything...")

if user_query:
    st.markdown(
        f"""
        <div class="rai-row user">
            <div class="rai-avatar user">YOU</div>
            <div class="rai-bubble-wrap">
                <div class="chat-bubble user-bubble">{user_query}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    row = st.container()
    with row:
        st.markdown(
            '<div class="rai-row bot"><div class="rai-avatar bot">RAI</div>'
            '<div class="rai-bubble-wrap" id="rai-live"></div></div>',
            unsafe_allow_html=True,
        )
        placeholder = st.empty()

    try:
        q_lower = user_query.lower()
        if "weather" in q_lower or "forecast" in q_lower:
            city = extract_city(user_query)
            answer, is_error = get_weather_report(city)
            bubble_class = "bot-bubble" if is_error else "bot-bubble rai-tool"
            placeholder.markdown(
                f'<div class="chat-bubble {bubble_class}">{answer}</div>',
                unsafe_allow_html=True,
            )
        else:
            answer = stream_reply(user_query, model_choice, placeholder)

        save_chat(user_query, answer)
    except Exception as err:
        placeholder.markdown(
            f'<div class="chat-bubble bot-bubble" style="border-color:#e8677a;color:#e8677a;">{err}</div>',
            unsafe_allow_html=True,
        )