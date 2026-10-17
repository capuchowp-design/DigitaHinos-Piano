/**
 * Servidor de licenças do Note Bounce Pro (Google Apps Script + Planilha Google).
 *
 * A planilha precisa ter uma aba chamada  licencas  com estas colunas na linha 1:
 *   A: codigo   B: aparelho   C: ativado_em   D: status   E: obs
 * - Coloque os códigos na coluna A (um por linha, a partir da linha 2).
 * - O app preenche sozinho as colunas B e C na primeira ativação.
 * - Para BLOQUEAR um código (reembolso, abuso): escreva  revogado  na coluna D.
 * - Para o cliente TROCAR DE CELULAR: apague o conteúdo das colunas B e C daquela linha.
 *
 * Passo a passo completo: servidor/LEIA-ME.txt
 */

var ABA = 'licencas';

// Rode UMA vez (menu Executar > configurar) para criar a aba e os títulos.
function configurar() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ABA) || ss.insertSheet(ABA);
  sh.getRange(1, 1, 1, 5).setValues([['codigo', 'aparelho', 'ativado_em', 'status', 'obs']]);
  sh.getRange(1, 1, 1000, 2).setNumberFormat('@'); // códigos e aparelhos sempre como TEXTO
  sh.setFrozenRows(1);
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function norm_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function doGet(e) {
  var p = (e && e.parameter) || {};
  var acao = String(p.a || '');
  var codigo = norm_(p.c);
  var disp = String(p.d || '').toLowerCase();

  if (!/^[a-f0-9]{16,64}$/.test(disp)) return resposta_({ ok: false, error: 'bad_request' });
  if (acao !== 'restore' && codigo.length !== 12) return resposta_({ ok: false, error: 'bad_request' });

  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return resposta_({ ok: false, error: 'busy' }); }
  try {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA);
    if (!sh) return resposta_({ ok: false, error: 'server_not_configured' });
    var n = sh.getLastRow() - 1;
    var rows = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];

    if (acao === 'restore') {
      for (var i = 0; i < rows.length; i++) {
        if (String(rows[i][1]).toLowerCase() === disp && norm_(rows[i][0]).length === 12) {
          if (String(rows[i][3]).toLowerCase() === 'revogado') return resposta_({ ok: false, error: 'revoked' });
          return resposta_({ ok: true, status: 'restored', code: norm_(rows[i][0]) });
        }
      }
      return resposta_({ ok: false, error: 'no_license' });
    }

    var linha = -1;
    for (var j = 0; j < rows.length; j++) { if (norm_(rows[j][0]) === codigo) { linha = j; break; } }
    if (linha < 0) return resposta_({ ok: false, error: 'not_found' });
    var r = rows[linha], aparelho = String(r[1]).toLowerCase();
    if (String(r[3]).toLowerCase() === 'revogado') return resposta_({ ok: false, error: 'revoked' });

    if (acao === 'activate') {
      if (!aparelho) {
        sh.getRange(linha + 2, 2, 1, 2).setValues([[disp, new Date()]]);
        SpreadsheetApp.flush();
        return resposta_({ ok: true, status: 'activated', code: codigo });
      }
      if (aparelho === disp) return resposta_({ ok: true, status: 'same', code: codigo });
      return resposta_({ ok: false, error: 'used' });
    }
    if (acao === 'verify') {
      if (!aparelho) return resposta_({ ok: false, error: 'unbound' });
      if (aparelho === disp) return resposta_({ ok: true, status: 'valid', code: codigo });
      return resposta_({ ok: false, error: 'used' });
    }
    return resposta_({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}
