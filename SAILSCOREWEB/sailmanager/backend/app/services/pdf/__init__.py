"""
app.services.pdf
----------------
Convenience exports for PDF generation.

Public API:
- generate_submitted_pdf(regatta_id: int, protest_id: int, snapshot: dict) -> tuple[str, str]
- generate_decision_pdf(regatta_id: int, protest_id: int, snapshot: dict, ...) -> tuple[pathlib.Path, str]
"""

from .generators import generate_submitted_pdf
from .decision_pdf import generate_decision_pdf

__all__ = ["generate_submitted_pdf", "generate_decision_pdf"]
