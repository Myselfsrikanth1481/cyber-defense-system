def extract_features(request, ip: str, count: int) -> list:
    """
    Enhanced feature extraction including fingerprint signals
    for the AI anomaly detector.
    """
    ua = request.headers.get("user-agent", "")
    path = request.url.path
    method = request.method

    # Suspicious user agent signals
    suspicious_ua = int(any(x in ua.lower() for x in [
        "python", "curl", "go-http", "java", "bot", "scanner",
        "nikto", "sqlmap", "nmap", "masscan"
    ]))
    no_ua = int(not ua)

    # Path suspicion signals
    suspicious_path = int(any(x in path.lower() for x in [
        "admin", "wp-", "phpmyadmin", ".env", "config",
        "shell", "eval", "cmd", "passwd", "shadow"
    ]))

    # Method signals
    non_get = int(method not in ("GET", "HEAD", "OPTIONS"))

    # Header count (bots often send fewer headers)
    header_count = len(request.headers)
    low_headers = int(header_count < 5)

    # Has common browser headers
    has_accept = int("accept" in request.headers)
    has_accept_lang = int("accept-language" in request.headers)

    return [
        count,              # request frequency
        len(path),          # path length
        int("?" in str(request.url)),  # query usage
        suspicious_ua,      # known scanner UA
        no_ua,              # missing user agent
        suspicious_path,    # probing known paths
        non_get,            # non-GET method
        low_headers,        # suspiciously few headers
        has_accept,         # has accept header
        has_accept_lang,    # has accept-language header
    ]