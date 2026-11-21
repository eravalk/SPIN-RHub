package com.spinplayer.app;
import java.util.*;import java.util.concurrent.*;
/** A bounded search; one slow provider must not serialize all other providers. */
public final class LyricsSearch {
 public interface Lookup{LyricsProvider.Result find(String source)throws Exception;}
 public static LyricsProvider.Result run(List<String> sources,ExecutorService executor,Lookup lookup,boolean automatic,long timeoutMs)throws Exception{
  CompletionService<LyricsProvider.Result> done=new ExecutorCompletionService<>(executor);Map<Future<LyricsProvider.Result>,String> pending=new HashMap<>();
  for(String source:sources)pending.put(done.submit(()->lookup.find(source)),source);
  LyricsProvider.Result result=new LyricsProvider.Result();long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(timeoutMs);
  try{while(!pending.isEmpty()){long left=deadline-System.nanoTime();if(left<=0)break;Future<LyricsProvider.Result> f=done.poll(left,TimeUnit.NANOSECONDS);if(f==null)break;String source=pending.remove(f);try{LyricsProvider.Result one=f.get();result.items.addAll(one.items);result.warnings.addAll(one.warnings);result.statuses.putAll(one.statuses);if(automatic)for(LyricsProvider.Candidate c:one.items)if(c.confident&&c.synced)return result;}catch(ExecutionException e){result.statuses.put(source,"source_unavailable");}}for(String source:pending.values())result.statuses.put(source,"network_timeout");}finally{for(Future<?> f:pending.keySet())f.cancel(true);}
  result.items.sort((a,b)->{int c=Boolean.compare(b.confident,a.confident);if(c!=0)return c;c=Boolean.compare(b.synced,a.synced);return c!=0?c:Double.compare(b.score,a.score);});return result;
 }
}
