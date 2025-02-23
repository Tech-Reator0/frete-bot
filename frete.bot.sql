CREATE TABLE fretes (
    id SERIAL PRIMARY KEY,
    origem VARCHAR(255),
    destino VARCHAR(255),
    valor NUMERIC,
    carga VARCHAR(255)
);

CREATE TABLE motoristas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255),
    telefone VARCHAR(20),
    cnh VARCHAR(20),
    tipo_veiculo VARCHAR(50),
    regiao VARCHAR(100)
);