import sys

FILE = r'src\components\StoryEditor.tsx'
with open(FILE, 'rb') as f:
    data = f.read()

# NOTE: 原始文件使用 => 而非转义形式，精确字节定位进行替换
OLD = (
    b'                   <div>\n'
    b'                     <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API \xe5\xaf\x86\xe9\x92\xa5</label>\n'
    b'                     <input \n'
    b'                       type="password"\n'
    b'                       placeholder="AI Studio API \xe5\xaf\x86\xe9\x92\xa5"\n'
    b'                       value={customApiKey}\n'
    b'                       onChange={e => setCustomApiKey(e.target.value)}\n'
    b'                       className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"\n'
    b'                     />\n'
    b'                     <p className="text-xs text-slate-500 mt-2">\n'
    b'                        \xe5\xa6\x82\xe6\x9e\x9c\xe7\x95\x99\xe7\xa9\xba\xef\xbc\x8c\xe5\xba\x94\xe7\x94\xa8\xe5\xb0\x86\xe5\xb0\x9d\xe8\xaf\x95\xe4\xbd\xbf\xe7\x94\xa8\xe5\x86\x85\xe7\xbd\xae\xe7\x9a\x84\xe7\xb3\xbb\xe7\xbb\x9f API \xe5\xaf\x86\xe9\x92\xa5\xe3\x80\x82\n'
    b'                     </p>\n'
    b'                   </div>'
)

if OLD not in data:
    sys.stdout.buffer.write(b'ERROR: old block not found in bytes\n')
    sys.exit(1)

# NOTE: 完整 AI 接口设置区块替换内容
NEW = (
    b'                   {/* AI Interface Settings */}\n'
    b'                   <div className="border-t border-slate-100 pt-4 space-y-4">\n'
    b'                     <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">AI \xe6\x8e\xa5\xe5\x8f\xa3\xe8\xae\xbe\xe7\xbd\xae</p>\n'
    b'\n'
    b'                     <div>\n'
    b'                       <label className="block text-sm font-medium text-slate-700 mb-2">AI \xe6\x8f\x90\xe4\xbe\x9b\xe5\x95\x86</label>\n'
    b'                       <div className="flex bg-slate-100 rounded-lg border border-slate-200 p-1 w-full">\n'
    b"                         <button onClick={() => setAiProvider('gemini')} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${aiProvider === 'gemini' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>Gemini</button>\n"
    b"                         <button onClick={() => setAiProvider('deepseek')} className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${aiProvider === 'deepseek' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`}>DeepSeek</button>\n"
    b'                       </div>\n'
    b'                     </div>\n'
    b'\n'
    b'                     {/* NOTE: thinking mode only active for DeepSeek, uses deepseek-reasoner model */}\n'
    b"                     <div className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-all ${aiProvider === 'deepseek' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50 opacity-40 pointer-events-none'}`}>\n"
    b'                       <div>\n'
    b'                         <span className="text-sm font-medium text-slate-700">\xe6\x80\x9d\xe8\x80\x83\xe6\xa8\xa1\xe5\xbc\x8f</span>\n'
    b'                         <p className="text-xs text-slate-400 mt-0.5">deepseek-reasoner\xef\xbc\x8c\xe6\x80\x9d\xe8\x80\x83\xe8\xbf\x87\xe7\xa8\x8b\xe5\x9c\xa8\xe5\x8f\xb3\xe4\xb8\x8a\xe8\xa7\x92\xe6\x98\xbe\xe7\xa4\xba</p>\n'
    b'                       </div>\n'
    b"                       <button onClick={() => setThinkingMode(!thinkingMode)} className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ml-4 ${thinkingMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>\n"
    b"                         <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${thinkingMode ? 'left-6' : 'left-1'}`} />\n"
    b'                       </button>\n'
    b'                     </div>\n'
    b'\n'
    b"                     {aiProvider === 'gemini' ? (\n"
    b'                       <div>\n'
    b'                         <label className="block text-sm font-medium text-slate-700 mb-1">Gemini API \xe5\xaf\x86\xe9\x92\xa5</label>\n'
    b'                         <input type="password" placeholder="AI Studio API \xe5\xaf\x86\xe9\x92\xa5" value={customApiKey} onChange={e => setCustomApiKey(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" />\n'
    b'                         <p className="text-xs text-slate-500 mt-2">\xe5\xa6\x82\xe6\x9e\x9c\xe7\x95\x99\xe7\xa9\xba\xef\xbc\x8c\xe5\xba\x94\xe7\x94\xa8\xe5\xb0\x86\xe5\xb0\x9d\xe8\xaf\x95\xe4\xbd\xbf\xe7\x94\xa8\xe5\x86\x85\xe7\xbd\xae\xe7\x9a\x84\xe7\xb3\xbb\xe7\xbb\x9f API \xe5\xaf\x86\xe9\x92\xa5\xe3\x80\x82</p>\n'
    b'                       </div>\n'
    b'                     ) : (\n'
    b'                       <div>\n'
    b'                         <label className="block text-sm font-medium text-slate-700 mb-1">DeepSeek API \xe5\xaf\x86\xe9\x92\xa5</label>\n'
    b'                         <input type="password" placeholder="DeepSeek Platform API \xe5\xaf\x86\xe9\x92\xa5" value={deepseekApiKey} onChange={e => setDeepseekApiKey(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow" />\n'
    b'                         <p className="text-xs text-slate-500 mt-2">\xe8\xaf\xb7\xe5\x9c\xa8 <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer" className="text-indigo-500 underline">platform.deepseek.com</a> \xe8\x8e\xb7\xe5\x8f\x96\xe5\xaf\x86\xe9\x92\xa5\xe3\x80\x82</p>\n'
    b'                       </div>\n'
    b'                     )}\n'
    b'                   </div>'
)

data2 = data.replace(OLD, NEW, 1)
if data2 == data:
    sys.stdout.buffer.write(b'ERROR: replace had no effect\n')
    sys.exit(1)

with open(FILE, 'wb') as f:
    f.write(data2)

sys.stdout.buffer.write(b'OK: settings panel patched successfully\n')
