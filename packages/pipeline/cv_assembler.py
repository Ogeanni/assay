"""
CV Assembler — takes original profile + rewriter output → produces a full rewritten CV.
Outputs both markdown (for display) and DOCX (for download).

DESIGN PRINCIPLES:
- Never invent — only use what came from the profile and rewriter
- Placeholders stay as [e.g. X] in the output so the user can find and fill them
- DOCX is clean and recruiter-ready with minimal formatting
"""

import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def build_markdown_cv(profile, rewrites: list[dict], summary_rewrite: Optional[str], target_role: str,) -> str:
    """
    Assembles a full rewritten CV in markdown.
    Uses rewritten bullets where available, original bullets otherwise.
    """
    lines = []

    # Header
    name = profile.name or "Your Name"
    lines.append(f"# {name}")
    lines.append(f"*Target role: {target_role}*")
    lines.append("")

    # Profile summary
    if summary_rewrite:
        lines.append("## Profile")
        lines.append(summary_rewrite)
        lines.append("")

    # Work experience
    has_experience = any(
        s.signal_type.value == "process"
        for s in profile.work_signals
    )

    if has_experience:
        lines.append("## Work Experience")
        lines.append("")

        # Build lookup from rewrites
        rewrite_map = {r["signal_name"]: r for r in rewrites}

        for signal in profile.work_signals:
            if signal.signal_type.value != "process":
                continue

            # Parse company and role from signal name
            if " — " in signal.name:
                company, role_title = signal.name.split(" — ", 1)
            else:
                company = signal.name
                role_title = ""

            lines.append(f"### {company}")
            if role_title:
                lines.append(f"**{role_title}**")
            lines.append("")

            rewrite = rewrite_map.get(signal.name)
            if rewrite and rewrite.get("bullets"):
                for bullet in rewrite["bullets"]:
                    status = bullet.get("status", "kept")
                    if status == "needs_detail":
                        # Flag bullets that need the user to add info
                        lines.append(f"- {bullet['rewritten']}  ⚠️ *Add detail here*")
                    else:
                        lines.append(f"- {bullet['rewritten']}")
            else:
                # Fall back to original bullets from raw_description
                original_bullets = signal.raw_description.split('\n')
                for b in original_bullets:
                    b = b.strip()
                    if b:
                        # Strip leading number if present (e.g. "1. bullet")
                        import re
                        b = re.sub(r'^\d+\.\s*', '', b)
                        lines.append(f"- {b}")

            lines.append("")

    # Projects (non-process signals)
    project_signals = [
        s for s in profile.work_signals
        if s.signal_type.value != "process"
    ]

    if project_signals:
        lines.append("## Projects")
        lines.append("")
        for signal in project_signals:
            lines.append(f"### {signal.name}")
            lines.append(signal.raw_description)
            lines.append("")

    # Skills
    if profile.technical_skills:
        lines.append("## Technical Skills")
        lines.append(", ".join(profile.technical_skills))
        lines.append("")

    if profile.domain_skills:
        lines.append("## Domain Skills")
        lines.append(", ".join(profile.domain_skills))
        lines.append("")

    # Footer note
    lines.append("---")
    lines.append(f"*CV rewritten by ASSAY on {datetime.now().strftime('%d %B %Y')}.*")
    lines.append("*Replace all [e.g. X] placeholders with your actual figures before sending.*")

    return "\n".join(lines)


def build_docx_cv(
    profile,
    rewrites: list[dict],
    summary_rewrite: Optional[str],
    target_role: str,
) -> bytes:
    """
    Produces a clean, recruiter-ready DOCX file.
    Returns bytes for direct HTTP response.
    """
    try:
        from docx import Document
        from docx.shared import Pt, RGBColor, Inches
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        import re
    except ImportError:
        logger.error("python-docx not installed")
        raise

    doc = Document()

    # ── Page margins ─────────────────────────────
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # ── Styles ───────────────────────────────────
    def add_name(text):
        p = doc.add_paragraph()
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(22)
        run.font.color.rgb = RGBColor(0x0a, 0x0a, 0x0a)
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        return p

    def add_section_header(text):
        p = doc.add_paragraph()
        run = p.add_run(text.upper())
        run.bold = True
        run.font.size = Pt(9)
        run.font.color.rgb = RGBColor(0x7c, 0x3a, 0xed)
        run.font.name = 'Courier New'
        # Add bottom border via paragraph format
        p.paragraph_format.space_before = Pt(12)
        p.paragraph_format.space_after = Pt(4)
        return p

    def add_role_header(company, role_title):
        p = doc.add_paragraph()
        run = p.add_run(company)
        run.bold = True
        run.font.size = Pt(11)
        if role_title:
            p.add_run(f"  ·  {role_title}").font.size = Pt(10)
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        return p

    def add_bullet(text, is_placeholder=False):
        p = doc.add_paragraph(style='List Bullet')
        # Highlight [e.g. X] placeholders
        pattern = re.compile(r'(\[e\.g\.[^\]]+\])')
        parts = pattern.split(text)
        for part in parts:
            run = p.add_run(part)
            run.font.size = Pt(10)
            if pattern.match(part):
                run.font.color.rgb = RGBColor(0xd9, 0x77, 0x00)  # amber for placeholders
                run.bold = True
        return p

    def add_body(text):
        p = doc.add_paragraph(text)
        p.runs[0].font.size = Pt(10) if p.runs else None
        p.paragraph_format.space_after = Pt(4)
        return p

    # ── Name ─────────────────────────────────────
    name = profile.name or "Your Name"
    add_name(name)

    target_p = doc.add_paragraph(f"Target role: {target_role}")
    target_p.runs[0].font.size = Pt(9)
    target_p.runs[0].font.color.rgb = RGBColor(0x71, 0x71, 0x7a)
    target_p.paragraph_format.space_after = Pt(6)

    # ── Profile summary ──────────────────────────
    if summary_rewrite:
        add_section_header("Profile")
        add_body(summary_rewrite)

    # ── Work experience ──────────────────────────
    has_experience = any(s.signal_type.value == "process" for s in profile.work_signals)
    if has_experience:
        add_section_header("Work Experience")
        rewrite_map = {r["signal_name"]: r for r in rewrites}

        for signal in profile.work_signals:
            if signal.signal_type.value != "process":
                continue

            if " — " in signal.name:
                company, role_title = signal.name.split(" — ", 1)
            else:
                company, role_title = signal.name, ""

            add_role_header(company, role_title)

            rewrite = rewrite_map.get(signal.name)
            if rewrite and rewrite.get("bullets"):
                for bullet in rewrite["bullets"]:
                    text = bullet.get("rewritten", bullet.get("original", ""))
                    needs_detail = bullet.get("status") == "needs_detail"
                    if needs_detail:
                        text = f"{text}  [Add detail here]"
                    add_bullet(text)
            else:
                original_bullets = signal.raw_description.split('\n')
                for b in original_bullets:
                    b = re.sub(r'^\d+\.\s*', '', b.strip())
                    if b:
                        add_bullet(b)

    # ── Projects ─────────────────────────────────
    project_signals = [s for s in profile.work_signals if s.signal_type.value != "process"]
    if project_signals:
        add_section_header("Projects")
        for signal in project_signals:
            p = doc.add_paragraph()
            run = p.add_run(signal.name)
            run.bold = True
            run.font.size = Pt(10)
            p.paragraph_format.space_after = Pt(2)
            add_body(signal.raw_description[:400])

    # ── Skills ───────────────────────────────────
    if profile.technical_skills:
        add_section_header("Technical Skills")
        add_body(", ".join(profile.technical_skills))

    if profile.domain_skills:
        add_section_header("Domain Skills")
        add_body(", ".join(profile.domain_skills))

    # ── Footer note ──────────────────────────────
    footer_p = doc.add_paragraph()
    footer_p.paragraph_format.space_before = Pt(16)
    run = footer_p.add_run(
        f"CV rewritten by ASSAY · {datetime.now().strftime('%d %B %Y')} · "
        "Replace all amber [e.g. X] placeholders with your actual figures before sending."
    )
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(0xa1, 0xa1, 0xaa)
    run.italic = True

    # ── Write to bytes ───────────────────────────
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()