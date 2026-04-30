FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=3001
ENV LISTEN=0.0.0.0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf-2.0-0 libffi8 \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --no-cache-dir .

RUN mkdir -p /templates

USER nobody
EXPOSE 3001
CMD ["pptx-template-mcp"]
