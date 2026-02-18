
CREATE TABLE public.daily_stock_eod (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  close NUMERIC NOT NULL,
  volume BIGINT NOT NULL DEFAULT 0,
  total_shares BIGINT,
  category TEXT,
  sector TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symbol, date)
);

ALTER TABLE public.daily_stock_eod ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Daily EOD data is publicly readable"
  ON public.daily_stock_eod
  FOR SELECT
  USING (true);

CREATE INDEX idx_daily_stock_eod_symbol ON public.daily_stock_eod(symbol);
CREATE INDEX idx_daily_stock_eod_date ON public.daily_stock_eod(date);
