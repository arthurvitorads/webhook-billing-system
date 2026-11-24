CREATE TABLE IF NOT EXISTS pagamentos (
    id CHAR(36) PRIMARY KEY,
    cliente VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    criado_em DATETIME(3) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS eventos_pagamento (
    id VARBINARY(512) PRIMARY KEY,
    pagamento_id CHAR(36) NOT NULL,
    status VARCHAR(20) NOT NULL,
    processado_em DATETIME(3) NOT NULL,
    INDEX (pagamento_id, processado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
