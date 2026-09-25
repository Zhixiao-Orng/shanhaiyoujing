#!/usr/bin/env python3
"""Local Task Atlas launcher and idempotent plan importer."""
import argparse,json,os,pathlib,subprocess,sys,time,urllib.request,shutil
ROOT=pathlib.Path(__file__).resolve().parent.parent
APP=ROOT/'app'
NODE=os.environ.get('TASK_ATLAS_NODE') or shutil.which('node')
if not NODE:raise RuntimeError('未找到 Node.js，请安装 Node.js 22.12+ 并确保 node 在 PATH 中。')
PORT=os.environ.get('TASK_ATLAS_PORT','47823')
URL='http://127.0.0.1:'+PORT
def api(path):
 with urllib.request.urlopen(URL+path,timeout=3) as r:return json.load(r)
def start():
 try:
  health=api('/health')
  if health.get('status') != 'ok':raise RuntimeError('端口已占用且不是预期服务')
  return
 except OSError:pass
 (APP/'.data').mkdir(exist_ok=True)
 env=dict(os.environ,CODEX_TASKBOARD_HOST='127.0.0.1',CODEX_TASKBOARD_PORT=PORT)
 with (APP/'.data/server.log').open('a') as log:
  p=subprocess.Popen([str(NODE),'server/index.mjs'],cwd=APP,env=env,stdout=log,stderr=log,start_new_session=True)
 for _ in range(30):
  if p.poll() is not None:raise RuntimeError('看板启动失败，请查看 app/.data/server.log')
  try:api('/health');return
  except OSError:time.sleep(.2)
 raise RuntimeError('启动超时，请查看 app/.data/server.log')
def cli(args):
 env=dict(os.environ,CODEX_TASKBOARD_URL=URL)
 p=subprocess.run([str(NODE),str(APP/'cli/taskctl.mjs'),*args],capture_output=True,text=True,env=env)
 if p.returncode:raise RuntimeError(p.stderr.strip())
 return json.loads(p.stdout)
def sync(file):
 data=json.loads(pathlib.Path(file).read_text());project=data['project'];nodes=data['nodes']
 import re
 if not re.fullmatch('[a-z0-9][a-z0-9-]{0,62}',project['id']):raise ValueError('project.id 应使用小写英文、数字或短横线')
 keys=[n['key'] for n in nodes]
 if not keys or len(keys)!=len(set(keys)):raise ValueError('nodes.key 必须非空且唯一')
 for n in nodes:
  if not re.fullmatch('[a-z0-9-]{1,60}',n['key']) or not n.get('title'):raise ValueError('key 或 title 无效')
  if n.get('parent') and n['parent'] not in keys:raise ValueError('父任务不存在')
  if n.get('status') and n['status'] not in ['backlog','todo','in_progress','in_review','blocked','done','canceled']:raise ValueError('状态无效')
  seen={n['key']};parent=n.get('parent')
  while parent:
   if parent in seen:raise ValueError('父子关系不能成环')
   seen.add(parent);parent=next(x for x in nodes if x['key']==parent).get('parent')
 start()
 if not any(p['id']==project['id'] for p in cli(['project','list'])['projects']):cli(['project','create','--id',project['id'],'--name',project['name']])
 existing=cli(['issue','list','--project',project['id']])['tasks'];mapping={}
 for index,n in enumerate(nodes):
  tag='atlas:'+n['key'];matches=[t for t in existing if tag in t['labels']]
  if len(matches)>1:raise ValueError('重复任务标识：'+tag)
  prior=matches[0] if matches else None
  labels=list(dict.fromkeys(([x for x in prior['labels'] if not x.startswith('atlas-order:')] if prior else [])+[tag,'atlas-order:'+str(index)]+(['想法池'] if n.get('idea') else [])))
  args=['--title',n['title'],'--labels',','.join(labels)]
  if 'description' in n:args+=['--description',n['description']]
  if 'status' in n:args+=['--status',n['status']]
  if prior:
   latest=cli(['issue','get',prior['id']])['task']
   t=cli(['issue','update',latest['id'],*args,'--if-version',str(latest['version'])])['task']
  else:t=cli(['issue','create','--project',project['id'],*args])['task']
  mapping[n['key']]=t['id']
 for n in nodes:
  if n.get('parent'):
   t=cli(['issue','get',mapping[n['key']]])['task'];parent=mapping[n['parent']]
   if (t['relations'].get('parent') or {}).get('id')!=parent:
    cli(['issue','relation','add',t['id'],'--type','parent','--issue',parent,'--if-version',str(t['version'])])
 return {'url':URL+'/?project='+project['id'],'tasks':mapping,'note':'未删除其他任务；未提供的状态保持不变'}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['start','sync','cli']);parser.add_argument('args',nargs=argparse.REMAINDER);a=parser.parse_args()
 if a.action=='sync':out=sync(a.args[0])
 elif a.action=='cli':start();out=cli(a.args)
 else:start();out={'url':URL}
 print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':
 try:main()
 except Exception as e:print(str(e),file=sys.stderr);sys.exit(1)
