# Unified Dockerfile for all VibeKit agents
ARG BASE_IMAGE=ubuntu:22.04
FROM ${BASE_IMAGE}

# Build arguments
ARG AGENT_TYPE=claude
ARG NODE_VERSION=24

# Copy and run the common installation script
COPY install-agent.sh /tmp/install-agent.sh
RUN chmod +x /tmp/install-agent.sh && \
    /tmp/install-agent.sh ${AGENT_TYPE} ${NODE_VERSION} && \
    rm /tmp/install-agent.sh