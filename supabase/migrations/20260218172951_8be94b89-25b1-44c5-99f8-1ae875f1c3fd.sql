
CREATE TABLE public.stock_fundamentals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  market_cap NUMERIC,
  authorized_cap NUMERIC,
  paid_up_cap NUMERIC,
  face_value NUMERIC,
  total_shares BIGINT,
  pe NUMERIC,
  eps NUMERIC,
  nav NUMERIC,
  listing_year INTEGER,
  year_high NUMERIC,
  year_low NUMERIC,
  last_agm TEXT,
  sector TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(symbol)
);

-- Enable RLS
ALTER TABLE public.stock_fundamentals ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Stock fundamentals are publicly readable"
ON public.stock_fundamentals
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_stock_fundamentals_updated_at
BEFORE UPDATE ON public.stock_fundamentals
FOR EACH ROW
EXECUTE FUNCTION public.update_historical_prices_updated_at();
