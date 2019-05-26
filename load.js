function pickBallot_(id) {
  var tableName = 'ballot-code-' + id;
  var table = fetchSheetRange_(BOX_DB_ID, tableName, 'A', 'B');
  
  var conditions = {
    'is_assigned': {
      'value': false,
      'type': Boolean,
    },
  }
  
  var ballot = '';
  
  while (true) {
    var unassigned_ballots = fetchCells_(table, conditions, 'code');
    
    if (unassigned_ballots.length === 0) {
      throw displayError_('BALLOT_RUN_OUT');
    }
    
    var idx = getRandint_(unassigned_ballots.length);
    var randomBallot = unassigned_ballots[idx];
    
    /* Double check if it is still unassigned */
    var dc_conditions = {
      'code': {'value': randomBallot},
    }
    var is_assigned = fetchCell_(table, dc_conditions, 'is_assigned', Boolean);
    
    if (!is_assigned) {
      addAssignRecord_(randomBallot);
      ballot = randomBallot;
      break;
    } else {
      continue;
    }
  }
  
  return ballot;
}

function addAssignRecord_(ballot) {
  var app = SpreadsheetApp.openById(BOX_DB_ID);
  var sheet = app.getSheetByName('ballot-used');
  
  var lock = LockService.getScriptLock();
  lock.waitLock(150000);
  
  sheet.appendRow([ballot]);
  SpreadsheetApp.flush();
  
  lock.releaseLock();
  
  return;
}

function renderBallotUrl_(ballots) {
  ballots = ballots || {};
  
  var ballotTypes = Object.keys(ballots);
  var ballotSetKey = ballotTypes.join('-');
  
  var table = fetchSheetRange_(DB_ID, 'ballot-sets', 'A', 'C');
  var formId = fetchCell_(table, {'serial': {'value': ballotSetKey}}, 'form_id')
  
  if (!formId) {
    // Fallback to full ballots
    formId = fetchCell_(table, {'id': {'value': '0'}}, 'form_id');
  }
  
  var form = FormApp.openById(formId);
  var fResp = form.createResponse();
  
  var items = form.getItems(FormApp.ItemType.TEXT);
  
  var prefills = []
  var reg = new RegExp('辨識碼.+\\[(\\d+)\\]$');
  
  /* Preliminary render */
  items.forEach(function(elm) {
    var item = elm.asTextItem();
    var title = item.getTitle();
    var m = title.match(reg);
    if (m) {
      var id = m[1];
      var fill = '';
      if (ballots[id]) {
        fill = ballots[id];
      } else {
        fill = '__INVALID__';
      }
      
      var resp = item.createResponse(fill);
      fResp.withItemResponse(resp);
    }
  })
  
  var prefilledUrl = fResp.toPrefilledUrl();
  
  return prefilledUrl;
}