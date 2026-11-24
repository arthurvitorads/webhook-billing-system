CREATE TABLE pagamentos (
    id CHAR(36) PRIMARY KEY,
    cliente VARCHAR(255) NOT NULL,
    valor DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    criado_em DATETIME(3) NOT NULL
);
