-- ativar_cartoes_pendentes_massas.sql
-- Objetivo: ativar em lote SOMENTE os cartões que ainda estão em "manufacturing"
-- (card_is_activated = false), criando a linha real em fintech.cards — mesma lógica
-- do endpoint /cards/physical/activate (index.cjs:3443-3496), só que sem exigir o
-- CVV/validade via API (script roda direto no banco pras massas de teste).
--
-- Replica o motor de geração de número (BINs reais + Luhn) de API/utils/cardEngine.js,
-- respeitando a bandeira já escolhida no onboarding (users.card_brand) — mesmo fix que
-- corrigimos no /cards/physical/activate pra não sortear bandeira aleatória.
--
-- Ajuste o WHERE dentro do FOR (bloco 2) se quiser mirar só algumas massas específicas
-- (mesmo padrão do insert_compra_manual_massas.sql).

-- 1) PREVIEW — quem ainda está sem cartão ativado.
SELECT cpf, full_name, card_brand, card_tier, card_delivery_status, card_is_activated
FROM fintech.users
WHERE role = 'customer'
  AND card_is_activated = false
  -- AND cpf IN ('11111111111', '22222222222')
ORDER BY full_name;

-- 2) ATIVAÇÃO EM LOTE
DO $$
DECLARE
    bins_visa       varchar[] := ARRAY['45767460','47660760','42031060','44466676'];
    bins_mastercard varchar[] := ARRAY['54427460','53736360','51854460','53642660'];
    bins_elo        varchar[] := ARRAY['65050666','65051960','65051860','65052260'];
    bins_amex       varchar[] := ARRAY['37828000','37148000','34008000','37878000'];
    bins_hipercard  varchar[] := ARRAY['60628200','63709500','63761200','63759900','63760900','63756800'];
    r RECORD;
    v_brand varchar;
    v_bin varchar;
    v_target_len int;
    v_random_len int;
    v_partial varchar;
    v_sum int;
    v_check int;
    v_raw varchar;
    v_formatted varchar;
    i int;
    d int;
    attempts int;
    v_exists int;
BEGIN
    FOR r IN
        SELECT cpf, card_brand, card_tier, card_product_type, card_cvv, card_expiry
        FROM fintech.users
        WHERE role = 'customer'
          AND card_is_activated = false
          -- AND cpf IN ('11111111111', '22222222222')
    LOOP
        v_brand := lower(coalesce(r.card_brand, ''));
        IF v_brand = 'visa' THEN v_bin := bins_visa[1 + floor(random()*4)::int];
        ELSIF v_brand = 'mastercard' THEN v_bin := bins_mastercard[1 + floor(random()*4)::int];
        ELSIF v_brand = 'elo' THEN v_bin := bins_elo[1 + floor(random()*4)::int];
        ELSIF v_brand = 'amex' THEN v_bin := bins_amex[1 + floor(random()*4)::int];
        ELSIF v_brand = 'hipercard' THEN v_bin := bins_hipercard[1 + floor(random()*6)::int];
        ELSE
            -- sem bandeira válida cadastrada: sorteia, mesmo fallback do cardEngine.js
            CASE floor(random()*5)::int
                WHEN 0 THEN v_bin := bins_mastercard[1 + floor(random()*4)::int]; v_brand := 'mastercard';
                WHEN 1 THEN v_bin := bins_visa[1 + floor(random()*4)::int]; v_brand := 'visa';
                WHEN 2 THEN v_bin := bins_elo[1 + floor(random()*4)::int]; v_brand := 'elo';
                WHEN 3 THEN v_bin := bins_amex[1 + floor(random()*4)::int]; v_brand := 'amex';
                ELSE v_bin := bins_hipercard[1 + floor(random()*6)::int]; v_brand := 'hipercard';
            END CASE;
        END IF;

        v_target_len := CASE WHEN v_brand = 'amex' THEN 15 ELSE 16 END;
        v_random_len := v_target_len - length(v_bin) - 1;

        attempts := 0;
        LOOP
            v_partial := v_bin;
            FOR i IN 1..v_random_len LOOP
                v_partial := v_partial || floor(random()*10)::int::text;
            END LOOP;

            -- Dígito verificador de Luhn — mesmo algoritmo de cardEngine.js:luhnCheckDigit
            v_sum := 0;
            FOR i IN 0..(length(v_partial)-1) LOOP
                d := substring(v_partial FROM (length(v_partial) - i) FOR 1)::int;
                IF i % 2 = 0 THEN
                    d := d * 2;
                    IF d > 9 THEN d := d - 9; END IF;
                END IF;
                v_sum := v_sum + d;
            END LOOP;
            v_check := (10 - (v_sum % 10)) % 10;
            v_raw := v_partial || v_check::text;

            SELECT count(*) INTO v_exists FROM fintech.cards WHERE card_number_raw = v_raw;
            EXIT WHEN v_exists = 0;
            attempts := attempts + 1;
            EXIT WHEN attempts > 10;
        END LOOP;

        IF v_brand = 'amex' THEN
            v_formatted := substring(v_raw from 1 for 4) || ' ' || substring(v_raw from 5 for 6) || ' ' || substring(v_raw from 11 for 5);
        ELSE
            v_formatted := regexp_replace(v_raw, '(\d{4})(?=\d)', '\1 ', 'g');
        END IF;

        INSERT INTO fintech.cards
            (id, user_cpf, card_number, card_number_raw, card_type, card_brand, bin, expiry, expiry_short, cvv, pin, is_activated, card_tier, product_type)
        VALUES (
            gen_random_uuid(), r.cpf, v_formatted, v_raw, 'physical', v_brand, v_bin,
            regexp_replace(r.card_expiry, '^(\d{2})/(\d{2})$', '\1/20\2'), r.card_expiry,
            r.card_cvv, '9898', true, r.card_tier, coalesce(r.card_product_type, 'PHYSICAL')
        );

        UPDATE fintech.users
        SET card_is_activated = true, card_delivery_status = 'unlocked', updated_at = CURRENT_TIMESTAMP
        WHERE cpf = r.cpf;
    END LOOP;
END $$;

-- 3) VERIFICAÇÃO — cartões recém-ativados.
SELECT c.user_cpf, u.full_name, c.card_number, c.card_brand, c.card_tier, c.product_type, c.is_activated
FROM fintech.cards c
JOIN fintech.users u ON u.cpf = c.user_cpf
WHERE c.created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY c.created_at DESC;
