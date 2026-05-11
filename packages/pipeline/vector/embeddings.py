"""
Embeddings pipeline — converts text to vectors using OpenAI.
 
Design decisions:
- Model: text-embedding-3-small (1536 dimensions)
  Chosen over text-embedding-3-large because:
  - 5x cheaper per token
  - Sufficient quality for profile similarity search
  - Same model used across dev and prod — no environment difference
- Batch embedding: multiple texts in one API call
  Reduces latency and cost when embedding multiple projects at once
- The embedding of a ResumeProfile is built from a structured
  text representation — not the raw PDF text. This means the
  vector captures semantic meaning of the profile, not formatting noise.
"""
import logging
from openai import AsyncOpenAI
from packages.core.schemas.resume import ResumeProfile

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

def profile_to_text(profile: ResumeProfile) -> str:
    """
    Convert a ResumeProfile to a structured text representation for embedding.
 
    Design decision: I embed a structured summary, not raw resume text.
    Raw text contains formatting noise (dates, addresses, header labels)
    that dilutes the semantic signal. A structured summary captures
    what matters — skills, project descriptions, domain experience.
    """
    parts = []

    if profile.target_role:
        parts.append(f"Target role: {profile.target_role}")
    
    if profile.technical_skills:
        parts.append(f"Technical skills: {', '.join(profile.technical_skills)}")

    if profile.domain_skills:
        parts.append(f"Domain: {', '.join(profile.domain_skills)}")

    for project in profile.work_signals:
        parts.append(f"Project: {project.name}. {project.raw_description}")

    for exp in profile.work_experience:
        parts.append(
            f"Experience: {exp.role} at {exp.company}"
            + (f" ({exp.domain})" if exp.domain else "")
        )

    return "\n".join(parts)


class EmbeddingPipeline:
    def __init__(self, client: AsyncOpenAI, model: str = EMBEDDING_MODEL):
        self.client = client
        self.model = model

    async def embed_text(self, text: str) -> list[float]:
        """Embed a single text string."""
        response = await self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding
    
    async def embed_profile(self, profile: ResumeProfile) -> list[float]:
        """
        Embed a full ResumeProfile.
        Converts to structured text first, then embeds.
        """
        text = profile_to_text(profile)
        logger.info(
            f"Embedding profile for {profile.name or 'unknown'} "
            f"({len(text)} chars)"
        )
        return await self.embed_text(text)
    
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Embed multiple texts in a single API call.
        More efficient than calling embed_text in a loop.
        Used in Phase 2 for batch cohort embedding.
        """
        response = await self.client.embeddings.create(
            model=self.model,
            input=texts
        )
        # Preserve input order — OpenAI returns embeddings in order
        return [item.embedding for item in sorted(
            response.data, key=lambda x: x.index
        )]