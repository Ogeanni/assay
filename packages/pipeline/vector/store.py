"""
Vector store abstraction — Chroma for dev, Pinecone for prod.
 
Design decision: Both stores implement the same VectorStore interface.
Agents and routers import get_vector_store() and call the four methods.
They never import Chroma or Pinecone directly.
Switching environments requires changing one env variable — nothing else.
 
The four operations:
- upsert   → store an embedding (insert or update)
- search   → find similar embeddings by semantic similarity
- get      → retrieve a specific embedding by ID
- delete   → remove an embedding by ID
 
Metadata stored alongside each embedding:
- user_id
- resume_id
- target_role (optional — for cohort search in Phase 2)
- created_at
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
 
logger = logging.getLogger(__name__)

from apps.api.config import settings

# ---------------------------------------------------------------------------
# Shared data structures
# ---------------------------------------------------------------------------

@dataclass
class VectorRecord:
    """A single stored embedding with its metadata."""
    id: str
    embedding: list[float]
    metadata: dict


@dataclass
class SearchResult:
    """A single result from a similarity search."""
    id: str
    score: float            # similarity score — higher is more similar
    metadata: dict

# ---------------------------------------------------------------------------
# Abstract interface — the contract both stores must fulfill
# ---------------------------------------------------------------------------

class VectorStore(ABC):

    @abstractmethod
    async def upsert(self, record: VectorRecord) -> None:
        """
        Store an embedding. If the ID already exists, overwrite it.
        This means re-uploading the same resume updates the embedding
        rather than creating a duplicate.
        """

        ...

    @abstractmethod
    async def search(self, query_embedding: list[float], top_k: int = 10, filter: Optional[dict] = None) -> list[SearchResult]:
        """
        Find the top_k most similar embeddings to the query.
        filter restricts results by metadata — e.g. {"target_role": "AI Engineer"}
        Used in Phase 2 for cohort search.
        """
        ...

    @abstractmethod
    async def get(self, id: str) -> Optional[VectorRecord]:
        """
        Retrieve a specific embedding by ID.
        Returns None if not found.
        """
        ...

    @abstractmethod
    async def delete(self, id: str) -> None:
        """
        Remove an embedding by ID.
        Called when a user deletes their resume.
        """
        ...


# ---------------------------------------------------------------------------
# Chroma implementation — development
# ---------------------------------------------------------------------------

class ChromaStore(VectorStore):
    """
    Local Chroma vector store for development.
    No API key, no network, runs in memory or on disk.
    Talks to the Chroma container in docker-compose via HTTP client.
    """

    def __init__(self, persist_dir: str = "data/chroma", collection_name: str = "assay_profiles"):
        import chromadb
        self.client = chromadb.PersistentClient(path=persist_dir)
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaStore initialized at {persist_dir}")

    async def upsert(self, record: VectorRecord) -> None:
        # Chroma's upsert is synchronous — wrapping in async for interface consistency
        self.collection.upsert(
            ids=[record.id],
            embeddings=[record.embedding],
            metadatas=[record.metadata]
        )
        logger.debug(f"ChromaStore upserted: {record.id}")

    async def search(self, query_embdeding: list[float], top_k: int = 10, filter: Optional[dict] = None) -> list[SearchResult]:
        kwargs = {
            "query_embeddings": [query_embdeding],
            "n_results": top_k,
            "include": ["metadatas", "distances"],
        }

        if filter:
            kwargs["where"] = filter

        results = self.collection.query(**kwargs)

        search_results = []
        if results["ids"] and results["ids"][0]:
            for i, id_ in enumerate(results["ids"][0]):
                # Chroma returns distances — convert to similarity score
                # cosine distance: 0 = identical, 2 = opposite
                # similarity score: 1 = identical, -1 = opposite
                distance = results["distances"][0][i]
                score = 1 - distance
                search_results.append(SearchResult(
                    id=id,
                    score=score,
                    metadata=results["metadatas"][0][i],
                ))
        return search_results
    
    async def get(self, id: str) -> Optional[VectorRecord]:
        results = self.collection.get(
            ids=[id],
            include=["embeddings", "metadatas"],
        )
        if not results["ids"]:
            return None
        
        return VectorStore(
            id=results["ids"][0],
            embedding=results["embeddings"][0],
            metadata=results["metadatas"][0],
        )


    async def delete(self, id: str) -> None:
        self.collection.delete(ids=[id])
        logger.debug(f"ChromaStore deleted: {id}")



# ---------------------------------------------------------------------------
# Pinecone implementation — production
# ---------------------------------------------------------------------------

class PineconeStore(VectorStore):
    """
    Pinecone vector store for production.
    Requires PINECONE_API_KEY and an existing index named assay-profiles.
 
    Index configuration (create once in Pinecone dashboard):
    - Dimensions: 1536 (text-embedding-3-small output size)
    - Metric: cosine
    - Cloud: aws, Region: us-east-1
    """

    def __init__(self):
        from pinecone import Pinecone
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        self.index = pc.Index(settings.PINECONE_INDEX_NAME)
        logger.info(f"PineconeStore initialized: index={settings.PINECONE_INDEX_NAME}")


    async def upsert(self, record: VectorRecord) -> None:
        self.index.upsert(vectors=[{
            "id":record.id,
            "value":record.embedding,
            "metadata":record.metadata,
        }])
        logger.debug(f"PineconeStore upserted: {record.id}")


    async def search(self, query_embedding: list[float], top_k: int = 10, filter: Optional[dict] = None) -> list[SearchResult]:
        kwargs = {
            "vector": query_embedding,
            "top_k": top_k,
            "include_metadata": True,
        }
        if filter:
            kwargs["filter"] = filter

        response = self.index.query(**kwargs)

        return [
            SearchResult(
                id=match["id"],
                score=match["score"],
                metadata=match.get("metadata", {}),
            )
            for match in response["matches"]
        ]
    
    async def get(self, id: str) -> Optional[VectorRecord]:
        response = self.index.fetch(ids=[id])
        vectors = response.get("vectors", {})

        if id not in vectors:
            return None
        
        vector = vectors[id]
        return VectorRecord(
            id=id,
            embedding=vector["values"],
            metadata=vector.get("metadata", {}),
        )
    
    async def delete(self, id: str) -> None:
        self.index.delete(ids=[id])
        logger.debug(f"PineconeStore deleted: {id}")



# ---------------------------------------------------------------------------
# Factory — the only function the rest of the codebase imports
# ---------------------------------------------------------------------------
 
def get_vector_store(
        chroma_persist_dir: str = "data/chroma",
        chroma_collection_name: str = "assay_profiles"
 ) -> VectorStore:
    """
    Returns the correct VectorStore implementation based on environment.
    Called once at startup in main.py lifespan and stored on app.state.
 
    Usage in main.py:
        app.state.vector_store = get_vector_store(
            use_pinecone=settings.use_pinecone,
            pinecone_api_key=settings.pinecone_api_key,
            pinecone_index_name=settings.pinecone_index_name,
        )
 
    Usage in an agent or router:
        vector_store: VectorStore = request.app.state.vector_store
        results = await vector_store.search(query_embedding, top_k=5)
    """
    if settings.use_pinecone:
        if not settings.PINECONE_API_KEY:
            raise ValueError("PINECONE_API_KEY must be set when running in production")
        
        logger.info("Using PineconeStore (production)")
        return PineconeStore(settings.PINECONE_API_KEY, settings.PINECONE_INDEX_NAME)
    
    logger.info("Using ChromaStore (development)")
    return ChromaStore(
        persist_dir=chroma_persist_dir,
        collection_name=chroma_collection_name,
    )