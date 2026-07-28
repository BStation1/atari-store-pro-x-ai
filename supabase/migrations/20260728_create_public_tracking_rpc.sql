-- =============================================================================
-- ATARI STORE PRO X - PUBLIC REPAIR ORDER TRACKING SECURITY DEFINER RPC
-- Provides a secure public verification mechanism without exposing the repair_orders
-- table directly to anonymous users or allowing table harvesting.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_public_tracking_order(p_token text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_meta jsonb;
  v_input_phone_clean text;
  v_phone_snap_clean text;
  v_guest_phone_clean text;
  v_cust_phone_clean text;
  v_matched boolean := false;
  v_devices_json jsonb := '[]'::jsonb;
  v_timeline_json jsonb := '[]'::jsonb;
  v_cust_name text := '';
  v_clean_token text;
BEGIN
  v_clean_token := lower(trim(coalesce(p_token, '')));
  
  -- Clean input phone digits
  v_input_phone_clean := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  IF v_input_phone_clean LIKE '20%' AND length(v_input_phone_clean) = 12 THEN
    v_input_phone_clean := substring(v_input_phone_clean from 3);
  ELSIF v_input_phone_clean LIKE '01%' AND length(v_input_phone_clean) = 11 THEN
    v_input_phone_clean := substring(v_input_phone_clean from 2);
  END IF;

  IF v_clean_token = '' OR v_input_phone_clean = '' THEN
    RETURN NULL;
  END IF;

  -- Search for matching order by tracking_token, order_number, or ID
  FOR v_row IN 
    SELECT ro.*, c.phone as registered_cust_phone, c.name as registered_cust_name
    FROM public.repair_orders ro
    LEFT JOIN public.customers c ON ro.customer_id = c.id
    WHERE lower(coalesce(ro.tracking_token, '')) = v_clean_token
       OR lower(coalesce(ro.order_number, '')) = v_clean_token
       OR lower(ro.id::text) = v_clean_token
  LOOP
    -- Parse notes JSON meta if present
    BEGIN
      IF v_row.notes IS NOT NULL AND v_row.notes LIKE '{%' THEN
        v_meta := v_row.notes::jsonb;
      ELSE
        v_meta := '{}'::jsonb;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_meta := '{}'::jsonb;
    END;

    -- Clean candidate phones
    v_phone_snap_clean := regexp_replace(coalesce(v_meta->>'customerPhoneSnapshot', ''), '\D', '', 'g');
    IF v_phone_snap_clean LIKE '20%' AND length(v_phone_snap_clean) = 12 THEN v_phone_snap_clean := substring(v_phone_snap_clean from 3);
    ELSIF v_phone_snap_clean LIKE '01%' AND length(v_phone_snap_clean) = 11 THEN v_phone_snap_clean := substring(v_phone_snap_clean from 2); END IF;

    v_guest_phone_clean := regexp_replace(coalesce(v_meta->>'guestCustomerPhone', ''), '\D', '', 'g');
    IF v_guest_phone_clean LIKE '20%' AND length(v_guest_phone_clean) = 12 THEN v_guest_phone_clean := substring(v_guest_phone_clean from 3);
    ELSIF v_guest_phone_clean LIKE '01%' AND length(v_guest_phone_clean) = 11 THEN v_guest_phone_clean := substring(v_guest_phone_clean from 2); END IF;

    v_cust_phone_clean := regexp_replace(coalesce(v_row.registered_cust_phone, ''), '\D', '', 'g');
    IF v_cust_phone_clean LIKE '20%' AND length(v_cust_phone_clean) = 12 THEN v_cust_phone_clean := substring(v_cust_phone_clean from 3);
    ELSIF v_cust_phone_clean LIKE '01%' AND length(v_cust_phone_clean) = 11 THEN v_cust_phone_clean := substring(v_cust_phone_clean from 2); END IF;

    -- Verify phone match
    IF (v_phone_snap_clean <> '' AND (v_phone_snap_clean = v_input_phone_clean OR position(v_input_phone_clean in v_phone_snap_clean) > 0 OR position(v_phone_snap_clean in v_input_phone_clean) > 0)) OR
       (v_guest_phone_clean <> '' AND (v_guest_phone_clean = v_input_phone_clean OR position(v_input_phone_clean in v_guest_phone_clean) > 0 OR position(v_guest_phone_clean in v_input_phone_clean) > 0)) OR
       (v_cust_phone_clean <> '' AND (v_cust_phone_clean = v_input_phone_clean OR position(v_input_phone_clean in v_cust_phone_clean) > 0 OR position(v_cust_phone_clean in v_input_phone_clean) > 0))
    THEN
      v_matched := true;
      v_cust_name := coalesce(v_meta->>'customerNameSnapshot', v_meta->>'guestCustomerName', v_row.registered_cust_name, 'عميلنا العزيز');
      
      IF v_meta ? 'devices' THEN
        v_devices_json := v_meta->'devices';
      ELSE
        v_devices_json := jsonb_build_array(jsonb_build_object(
          'id', v_row.id,
          'type', coalesce(v_row.device_type, 'أجهزة ألعاب'),
          'model', coalesce(v_row.device_model, 'موديل قياسي'),
          'serialNumber', coalesce(v_row.serial_number, ''),
          'issue', coalesce(v_row.reported_issue, 'فحص ومعاينة الكشف العام'),
          'status', v_row.status,
          'estimatedCost', coalesce(v_row.estimated_cost, 0),
          'finalRepairPrice', coalesce(v_row.final_cost, 0)
        ));
      END IF;

      IF v_meta ? 'timelineEvents' THEN
        v_timeline_json := v_meta->'timelineEvents';
      END IF;

      -- Return strictly customer-safe fields
      RETURN jsonb_build_object(
        'id', coalesce(v_row.order_number, v_row.id::text),
        'trackingToken', v_row.tracking_token,
        'status', v_row.status,
        'receivedDate', v_row.created_at,
        'completionDate', v_meta->>'completionDate',
        'totalEstimatedCost', coalesce(v_row.estimated_cost, 0),
        'finalRepairPrice', coalesce(v_row.final_cost, 0),
        'advancePayment', coalesce((v_meta->>'advancePayment')::numeric, 0),
        'isPaid', coalesce((v_meta->>'isPaid')::boolean, v_row.status = 'DELIVERED'),
        'warrantyDays', (v_meta->>'warrantyDays')::numeric,
        'warrantyEndDate', v_meta->>'warrantyEndDate',
        'customerName', v_cust_name,
        'devices', v_devices_json,
        'timelineEvents', v_timeline_json
      );
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking_order(text, text) TO public;
GRANT EXECUTE ON FUNCTION public.get_public_tracking_order(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_tracking_order(text, text) TO authenticated;
