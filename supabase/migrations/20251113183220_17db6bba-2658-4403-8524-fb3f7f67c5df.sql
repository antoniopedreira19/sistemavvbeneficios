-- Etapa 1: Adicionar novo tipo de usuário "operacional" ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operacional';