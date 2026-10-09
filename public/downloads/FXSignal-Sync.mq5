//+------------------------------------------------------------------+
//|                                              FXSignal-Sync.mq5   |
//|   Read-only journal sync for FXSignal (EUR/USD and USD/JPY).     |
//|                                                                  |
//|   Sends your positions to your FXSignal journal once a minute.   |
//|   It never opens, modifies or closes a trade.                    |
//|                                                                  |
//|   Setup:                                                         |
//|   1. Tools > Options > Expert Advisors: tick "Allow WebRequest   |
//|      for listed URL" and add  https://fxsignal.duckdns.org       |
//|   2. Copy this file to  File > Open Data Folder > MQL5/Experts,  |
//|      then refresh the Navigator (or compile it in MetaEditor).   |
//|   3. Drag "FXSignal-Sync" onto any chart, paste your sync key    |
//|      (FXSignal > Settings > MT5 sync) and press OK.              |
//+------------------------------------------------------------------+
#property copyright   "FXSignal"
#property version     "1.00"
#property description "Read-only: sends your EUR/USD and USD/JPY trades to your FXSignal journal. Never opens, changes or closes trades."

input string SyncKey         = "";                                         // Sync key (FXSignal > Settings > MT5 sync)
input string ApiUrl          = "https://fxsignal.duckdns.org/api/mt5/sync"; // FXSignal sync address
input int    DaysBack        = 14;                                         // Closed trades from the last N days
input int    IntervalSeconds = 60;                                         // How often to sync

int OnInit()
  {
   if(StringLen(SyncKey) < 20)
     {
      Alert("FXSignal Sync: paste your sync key in the inputs (FXSignal > Settings > MT5 sync).");
      return(INIT_PARAMETERS_INCORRECT);
     }
   EventSetTimer(MathMax(30, IntervalSeconds));
   Sync();
   return(INIT_SUCCEEDED);
  }

void OnDeinit(const int reason)
  {
   EventKillTimer();
   Comment("");
  }

void OnTimer()
  {
   Sync();
  }

//--- Only the pairs FXSignal publishes (any broker suffix: EURUSDm, EURUSD.raw, ...)
bool Wanted(string symbol)
  {
   string s = symbol;
   StringToUpper(s);
   return(StringFind(s, "EURUSD") >= 0 || StringFind(s, "USDJPY") >= 0);
  }

string Esc(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   return(s);
  }

//--- Broker server time -> UTC seconds.
long ToUtc(datetime serverTime, long offset)
  {
   return((long)serverTime - offset);
  }

//--- One position (open or closed) as JSON, from its deals. "" when unusable.
string PositionJson(ulong positionId, long offset)
  {
   if(!HistorySelectByPosition(positionId))
      return("");
   string   symbol = "";
   long     side = -1;
   double   inVol = 0, inPx = 0, outVol = 0, outPx = 0, sl = 0, tp = 0, profit = 0;
   datetime openT = 0, closeT = 0;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong t = HistoryDealGetTicket(i);
      if(t == 0)
         continue;
      long     entry = HistoryDealGetInteger(t, DEAL_ENTRY);
      long     type  = HistoryDealGetInteger(t, DEAL_TYPE);
      double   vol   = HistoryDealGetDouble(t, DEAL_VOLUME);
      double   px    = HistoryDealGetDouble(t, DEAL_PRICE);
      datetime when  = (datetime)HistoryDealGetInteger(t, DEAL_TIME);
      profit += HistoryDealGetDouble(t, DEAL_PROFIT) + HistoryDealGetDouble(t, DEAL_SWAP) + HistoryDealGetDouble(t, DEAL_COMMISSION);
      if(entry == DEAL_ENTRY_IN && (type == DEAL_TYPE_BUY || type == DEAL_TYPE_SELL))
        {
         symbol = HistoryDealGetString(t, DEAL_SYMBOL);
         side   = type;
         inPx   = (inPx * inVol + px * vol) / (inVol + vol);
         inVol += vol;
         if(openT == 0 || when < openT)
            openT = when;
         sl = HistoryDealGetDouble(t, DEAL_SL);
         tp = HistoryDealGetDouble(t, DEAL_TP);
        }
      else
         if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
           {
            outPx   = (outPx * outVol + px * vol) / (outVol + vol);
            outVol += vol;
            if(when > closeT)
               closeT = when;
           }
     }
   if(inVol <= 0 || symbol == "" || !Wanted(symbol))
      return("");
//--- Still open: use the live stop and target (they may have been moved).
   if(PositionSelectByTicket(positionId))
     {
      sl = PositionGetDouble(POSITION_SL);
      tp = PositionGetDouble(POSITION_TP);
     }
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   if(digits <= 0)
      digits = 5;
   string j = "{\"id\":\"" + IntegerToString((long)positionId) + "\"" +
              ",\"symbol\":\"" + Esc(symbol) + "\"" +
              ",\"side\":\"" + (side == DEAL_TYPE_BUY ? "BUY" : "SELL") + "\"" +
              ",\"openTime\":" + IntegerToString(ToUtc(openT, offset)) +
              ",\"openPrice\":" + DoubleToString(inPx, digits) +
              ",\"volume\":" + DoubleToString(inVol, 2) +
              ",\"sl\":" + DoubleToString(sl, digits) +
              ",\"tp\":" + DoubleToString(tp, digits) +
              ",\"closedVolume\":" + DoubleToString(outVol, 2);
   if(outVol > 0)
      j += ",\"closePrice\":" + DoubleToString(outPx, digits) +
           ",\"closeTime\":" + IntegerToString(ToUtc(closeT, offset));
   j += ",\"profit\":" + DoubleToString(profit, 2) + "}";
   return(j);
  }

bool Contains(const ulong &ids[], int n, ulong id)
  {
   for(int k = 0; k < n; k++)
      if(ids[k] == id)
         return(true);
   return(false);
  }

void Sync()
  {
//--- Broker offset from UTC, rounded to 15 minutes.
   long offset = (long)(TimeTradeServer() - TimeGMT());
   offset = (long)MathRound(offset / 900.0) * 900;

   ulong ids[];
   int   n = 0;
//--- Positions with deals in the last DaysBack days.
   if(HistorySelect(TimeCurrent() - DaysBack * 86400, TimeCurrent() + 86400))
     {
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
        {
         ulong t = HistoryDealGetTicket(i);
         if(t == 0 || !Wanted(HistoryDealGetString(t, DEAL_SYMBOL)))
            continue;
         long type = HistoryDealGetInteger(t, DEAL_TYPE);
         if(type != DEAL_TYPE_BUY && type != DEAL_TYPE_SELL)
            continue;
         ulong pid = (ulong)HistoryDealGetInteger(t, DEAL_POSITION_ID);
         if(pid == 0 || Contains(ids, n, pid))
            continue;
         ArrayResize(ids, n + 1);
         ids[n++] = pid;
        }
     }
//--- Positions still open (even if opened before DaysBack).
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      if(PositionGetTicket(i) == 0 || !Wanted(PositionGetString(POSITION_SYMBOL)))
         continue;
      ulong pid = (ulong)PositionGetInteger(POSITION_IDENTIFIER);
      if(Contains(ids, n, pid))
         continue;
      ArrayResize(ids, n + 1);
      ids[n++] = pid;
     }

   string items = "";
   int    count = 0;
   for(int k = 0; k < n && count < 400; k++)
     {
      string item = PositionJson(ids[k], offset);
      if(item == "")
         continue;
      items += (count > 0 ? "," : "") + item;
      count++;
     }

   string body = "{\"account\":\"" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + "\"" +
                 ",\"broker\":\"" + Esc(AccountInfoString(ACCOUNT_COMPANY)) + "\"" +
                 ",\"server\":\"" + Esc(AccountInfoString(ACCOUNT_SERVER)) + "\"" +
                 ",\"version\":\"1.0\"" +
                 ",\"positions\":[" + items + "]}";
   Post(body, count);
  }

void Post(string body, int count)
  {
   char   data[];
   char   result[];
   string replyHeaders;
   int len = StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   if(len > 0)
      ArrayResize(data, len - 1); // drop the terminating zero
   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + SyncKey + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", ApiUrl, headers, 15000, data, result, replyHeaders);
   if(code == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         Comment("FXSignal Sync: allow WebRequest for https://fxsignal.duckdns.org in Tools > Options > Expert Advisors.");
      else
         Comment("FXSignal Sync: could not reach FXSignal (error ", err, "). Retrying.");
      return;
     }
   string reply = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code != 200)
     {
      Comment("FXSignal Sync: server replied ", code, ": ", reply);
      return;
     }
   Comment("FXSignal Sync: OK at ", TimeToString(TimeLocal(), TIME_MINUTES), " - ", count, " positions sent. Read-only.");
  }
//+------------------------------------------------------------------+
