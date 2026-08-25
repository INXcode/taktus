CREATE POLICY "tickets_select_langsam" ON public.tickets
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());
CREATE POLICY "tickets_select_schnell" ON public.tickets
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));
