/**
 * ATIVAÇÃO PRO — Google Apps Script (cole este arquivo inteiro em Extensões > Apps Script da sua planilha)
 *
 * A planilha guarda os códigos. Cada código só pode ser ativado em UM aparelho:
 *   - 1ª vez que alguém digita o código -> grava o identificador do aparelho (status "ativo")
 *   - mesmo aparelho de novo (reinstalou/limpou dados) -> libera de novo
 *   - outro aparelho tentando o mesmo código -> recusa e conta a tentativa
 *
 * O app chama este script assim:  ?a=activate|verify|restore &c=CODIGO &d=ID_DO_APARELHO
 */
var ABA = 'Codigos';
var COLS = ['codigo', 'status', 'dispositivo', 'ativado_em', 'cliente', 'app', 'observacao', 'ultima_verificacao', 'tentativas_outro_aparelho'];
// posição (1 = coluna A) de cada campo
var C = { codigo: 1, status: 2, dispositivo: 3, ativado_em: 4, cliente: 5, app: 6, obs: 7, ultima: 8, tent: 9 };
var CARACTERES = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I para não confundir ao digitar

function aba_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA);
  if (!sh) { sh = ss.insertSheet(ABA); }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, COLS.length).setValues([COLS]).setFontWeight('bold').setBackground('#fcad2a');
    sh.setFrozenRows(1);
  }
  // códigos e aparelhos sempre como TEXTO (evita o Sheets transformar o ID em número)
  sh.getRange(1, C.codigo, sh.getMaxRows(), 1).setNumberFormat('@');
  sh.getRange(1, C.dispositivo, sh.getMaxRows(), 1).setNumberFormat('@');
  return sh;
}

function normalizar_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function formatar_(c) { // PROXXXXXXXX -> PRO-XXXX-XXXX
  c = normalizar_(c);
  return c.length === 11 && c.indexOf('PRO') === 0 ? 'PRO-' + c.substr(3, 4) + '-' + c.substr(7, 4) : c;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Pro')
    .addItem('Preparar planilha', 'configurarPlanilha')
    .addItem('Gerar 10 códigos novos', 'gerar10')
    .addItem('Gerar 50 códigos novos', 'gerar50')
    .addSeparator()
    .addItem('Liberar aparelho da linha selecionada (código volta a ser livre)', 'liberarLinha')
    .addItem('Bloquear linha selecionada', 'bloquearLinha')
    .addToUi();
}

function configurarPlanilha() { aba_(); SpreadsheetApp.getUi().alert('Planilha pronta! Agora use o menu Pro > Gerar códigos.'); }
function gerar10() { gerarCodigos(10); }
function gerar50() { gerarCodigos(50); }

function gerarCodigos(n) {
  var sh = aba_();
  var existentes = {};
  var ult = sh.getLastRow();
  if (ult > 1) sh.getRange(2, 1, ult - 1, 1).getValues().forEach(function (r) { existentes[normalizar_(r[0])] = true; });
  var linhas = [];
  while (linhas.length < n) {
    var s = '';
    for (var i = 0; i < 8; i++) s += CARACTERES.charAt(Math.floor(Math.random() * CARACTERES.length));
    var cod = 'PRO' + s;
    if (existentes[cod]) continue;
    existentes[cod] = true;
    linhas.push([formatar_(cod), 'livre', '', '', '', '', '', '', 0]);
  }
  sh.getRange(sh.getLastRow() + 1, 1, linhas.length, COLS.length).setValues(linhas);
  return linhas.length;
}

function liberarLinha() {
  var sh = aba_(), r = sh.getActiveRange().getRow();
  if (r < 2) return;
  sh.getRange(r, C.status).setValue('livre');
  sh.getRange(r, C.dispositivo).setValue('');
  sh.getRange(r, C.ativado_em).setValue('');
}
function bloquearLinha() {
  var sh = aba_(), r = sh.getActiveRange().getRow();
  if (r < 2) return;
  sh.getRange(r, C.status).setValue('bloqueado');
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Recebe os pedidos do app. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var acao = String(p.a || '');
  var codigo = normalizar_(p.c);
  var disp = String(p.d || '').toLowerCase();

  if (!acao) return resposta_({ ok: true, msg: 'Ativação Pro funcionando' });
  if (!/^[a-f0-9]{16,64}$/.test(disp)) return resposta_({ ok: false, error: 'bad_request' });
  if (acao !== 'restore' && (codigo.length < 8 || codigo.length > 16)) return resposta_({ ok: false, error: 'bad_request' });

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return resposta_({ ok: false, error: 'busy' }); }
  try {
    var sh = aba_();
    var n = sh.getLastRow() - 1;
    var rows = n > 0 ? sh.getRange(2, 1, n, COLS.length).getValues() : [];
    var agora = new Date();

    // ---- restaurar: o app perdeu a licença (limpou dados/reinstalou) e procura pelo aparelho ----
    if (acao === 'restore') {
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][C.dispositivo - 1]).toLowerCase() === disp) {
          var st = String(rows[i][C.status - 1]).toLowerCase();
          if (st === 'bloqueado') return resposta_({ ok: false, error: 'revoked' });
          if (st === 'ativo') {
            sh.getRange(i + 2, C.ultima).setValue(agora);
            return resposta_({ ok: true, status: 'restored', code: normalizar_(rows[i][C.codigo - 1]) });
          }
        }
      }
      return resposta_({ ok: false, error: 'no_license' });
    }

    // ---- achar a linha do código ----
    var idx = -1;
    for (var j = 0; j < rows.length; j++) { if (normalizar_(rows[j][C.codigo - 1]) === codigo) { idx = j; break; } }
    if (idx < 0) return resposta_({ ok: false, error: 'not_found' });
    var linha = idx + 2;
    var status = String(rows[idx][C.status - 1]).toLowerCase();
    var aparelho = String(rows[idx][C.dispositivo - 1]).toLowerCase();
    if (status === 'bloqueado') return resposta_({ ok: false, error: 'revoked' });

    if (acao === 'activate') {
      if (!aparelho) {                       // primeira ativação
        sh.getRange(linha, C.dispositivo).setNumberFormat('@').setValue(disp);
        sh.getRange(linha, C.status).setValue('ativo');
        sh.getRange(linha, C.ativado_em).setValue(agora);
        sh.getRange(linha, C.ultima).setValue(agora);
        SpreadsheetApp.flush();
        return resposta_({ ok: true, status: 'activated', code: codigo });
      }
      if (aparelho === disp) {               // mesmo aparelho de novo
        sh.getRange(linha, C.status).setValue('ativo');
        sh.getRange(linha, C.ultima).setValue(agora);
        return resposta_({ ok: true, status: 'same', code: codigo });
      }
      sh.getRange(linha, C.tent).setValue((Number(rows[idx][C.tent - 1]) || 0) + 1);   // outro aparelho
      return resposta_({ ok: false, error: 'used' });
    }

    if (acao === 'verify') {
      if (!aparelho) return resposta_({ ok: false, error: 'unbound' });
      if (aparelho === disp) {
        sh.getRange(linha, C.ultima).setValue(agora);
        return resposta_({ ok: true, status: 'valid', code: codigo });
      }
      return resposta_({ ok: false, error: 'used' });
    }
    return resposta_({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}
