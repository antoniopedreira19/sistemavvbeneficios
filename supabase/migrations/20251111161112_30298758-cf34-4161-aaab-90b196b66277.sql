-- Add new columns to colaboradores table
ALTER TABLE public.colaboradores
ADD COLUMN sexo text,
ADD COLUMN salario numeric(10, 2),
ADD COLUMN classificacao text,
ADD COLUMN classificacao_salario text,
ADD COLUMN aposentado boolean DEFAULT false,
ADD COLUMN afastado boolean DEFAULT false,
ADD COLUMN cid text;

-- Add check constraint for salario
ALTER TABLE public.colaboradores
ADD CONSTRAINT check_salario_non_negative CHECK (salario >= 0);

-- Add check constraint for sexo
ALTER TABLE public.colaboradores
ADD CONSTRAINT check_sexo_valid CHECK (sexo IN ('Masculino', 'Feminino', 'Outro'));

-- Add check constraint for classificacao
ALTER TABLE public.colaboradores
ADD CONSTRAINT check_classificacao_valid CHECK (classificacao IN ('CLT', 'SÓCIOS', 'PRESTADOR DE SERVIÇO'));

-- Create unique index for cpf per empresa
CREATE UNIQUE INDEX idx_colaboradores_cpf_empresa ON public.colaboradores(cpf, empresa_id);