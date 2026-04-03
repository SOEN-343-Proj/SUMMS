# Test Suite

All automated tests live under this folder to keep them isolated from application code.

## Structure

- `tests/unit/backend/` contains focused unit tests for backend domain logic.
- `tests/integration/backend/` contains route-level integration tests for the FastAPI app.
- `tests/test_support.py` provides shared state reset helpers and temp-file isolation.

## Running

Run the full suite from the project root:

```bash
python3 -m unittest discover -s tests
```

Run only unit tests:

```bash
python3 -m unittest discover -s tests/unit
```

Run only integration tests:

```bash
python3 -m unittest discover -s tests/integration
```

## Optional Dependency

The integration tests use FastAPI's `TestClient`, which requires `httpx`.
If it is not installed yet:

```bash
python3 -m pip install -r tests/requirements.txt
```

