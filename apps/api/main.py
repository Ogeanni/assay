import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI

from packages.db import create_engine, create_session_factory
from apps.api.config import settings

from packages.pipeline.agents.graph import build_graph
from packages.pipeline.parser.resume_parser import ResumeParser
from packages.pipeline.vector.embeddings import EmbeddingPipeline
from packages.pipeline.vector.store import get_vector_store

from apps.api.routers import auth, resume, report, jobs

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    engine = create_engine(settings.DATABASE_URL)
    app.state.engine = engine
    app.state.session_factory = create_session_factory(engine)

    openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    app.state.openai_client = openai_client

    app.state.parser = ResumeParser(openai_client)
    app.state.graph = build_graph(openai_client)
    app.state.embedding_pipeline = EmbeddingPipeline(openai_client)
    app.state.vector_store = get_vector_store()

    yield
    await app.state.engine.dispose()

app = FastAPI(
    title="ASSAY",
    description="Talent intelligence — depth over credentials",
    version="1.0.0",
    lifespan=lifespan

)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(resume.router, prefix="/api/v1")
app.include_router(report.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")

@app.get("/health")
async def health():
    return {"status": "ok", "service": "assay"}
