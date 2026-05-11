import logging
from openai import AsyncOpenAI
from langgraph.graph import StateGraph, END

from packages.pipeline.agents.depth_agent import DepthAgent
from packages.pipeline.agents.gap_agent import GapAgent
from packages.pipeline.agents.narrative_agent import NarrativeAgent
from packages.pipeline.agents.state import AssayState

logger = logging.getLogger(__name__)

def build_graph(client: AsyncOpenAI, model: str = "gpt-4o-mini"):
    depth_agent = DepthAgent(client, model)
    gap_agent = GapAgent(client, model)
    narrative_agent = NarrativeAgent(client, model)

    # Node wrapper functions
    async def depth_node(state: AssayState) -> dict:
        return await depth_agent.run(state)
    async def gap_node(state: AssayState) -> dict:
        return await gap_agent.run(state)
    async def narrative_node(state: AssayState) -> dict:
        return await narrative_agent.run(state)
    
    # Build the graph
    graph = StateGraph(AssayState)

    # Register nodes
    graph.add_node("depth_agent", depth_node)
    graph.add_node("gap_agent", gap_node)
    graph.add_node("narrative_agent", narrative_node)

    # Set entry point and edges
    graph.set_entry_point("depth_agent")
    graph.add_edge("depth_agent", "gap_agent")
    graph.add_edge("gap_agent", "narrative_agent")
    graph.add_edge("narrative_agent", END)

    return graph.compile()

