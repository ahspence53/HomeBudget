// ---------- Projection Find / Find Next ----------
let lastProjectionFindIndex = -1;

function projectionFindNext() {
    const q = (document.getElementById("projection-find-input").value || "").trim().toLowerCase();
    if (!q) { alert("Enter search text for Find."); return; }

    const rows = Array.from(document.querySelectorAll("#projection-table tbody tr"));
    if (rows.length === 0) return alert("No projection rows to search.");

    let start = lastProjectionFindIndex + 1;
    if (start >= rows.length) start = 0;

    for (let i = 0; i < rows.length; i++) {
        const idx = (start + i) % rows.length;
        const row = rows[idx];
        const txt = row.textContent.toLowerCase();
        if (txt.includes(q)) {
            // Remove previous highlight
            rows.forEach(r => r.classList.remove("projection-match-highlight"));
            // Highlight this row
            row.classList.add("projection-match-highlight");
            // Scroll row into center view
            row.scrollIntoView({ behavior: "smooth", block: "center" });
            lastProjectionFindIndex = idx;
            return;
        }
    }
    alert("No more matches.");
    lastProjectionFindIndex = -1;
}

// Find button starts search from top
document.getElementById("projection-find-btn").addEventListener("click", () => {
    lastProjectionFindIndex = -1;
    projectionFindNext();
});

// Find Next button continues search
document.getElementById("projection-find-next-btn").addEventListener("click", projectionFindNext);

// Reset highlight when search input changes
document.getElementById("projection-find-input").addEventListener("input", () => {
    lastProjectionFindIndex = -1;
    const rows = document.querySelectorAll("#projection-table tbody tr");
    rows.forEach(r => r.classList.remove("projection-match-highlight"));
});
