FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y tor && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/tor && chown debian-tor:debian-tor /var/lib/tor

COPY torrc /etc/tor/torrc

USER debian-tor

EXPOSE 9050 9051

CMD ["tor", "-f", "/etc/tor/torrc"]
