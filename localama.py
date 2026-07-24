import os
import streamlit as st
from dotenv import load_dotenv
from langchain_community.llms import Ollama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

# Load environment variables (not strictly needed here)
load_dotenv()

# Streamlit title
st.title('RAI buddy')

# Load and show logo
logo_path = os.path.join(os.getcwd(), "KMITL-Logo-2024-1024x1024.png")
if os.path.exists(logo_path):
    st.image(logo_path, width=60)
else:
    st.warning("Logo not found at path: " + logo_path)

# Input field
input_text = st.text_input("Search the topic you want:")

# Prompt setup
prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant. Please respond to the user queries"),
    ("user", "Question: {question}")
])

# Load Ollama model
llm = Ollama(model="llama2")  # Or llama3, gemma:2b, etc.
output_parser = StrOutputParser()
chain = prompt | llm | output_parser

# Process input
if input_text:
    response = chain.invoke({"question": input_text})
    st.write(response)

# Load and apply CSS styles
css_path = os.path.join(os.getcwd(), "styles.css")
if os.path.exists(css_path):
    with open(css_path) as f:
        css_content = f.read()
        st.markdown(f"<style>{css_content}</style>", unsafe_allow_html=True)
else:
    st.warning("CSS file not found. Please ensure 'styles.css' exists.")
