// Create this new component

const DebugToken = () => {
  const accessToken = localStorage.getItem('accessToken');
  let tokenData = "No token found";
  
  if (accessToken) {
    try {
      const base64Url = accessToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));

      tokenData = JSON.stringify(JSON.parse(jsonPayload), null, 2);
    } catch (error) {
      tokenData = `Error parsing token: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  return (
    <div style={{position: 'fixed', bottom: '10px', right: '10px', zIndex: 9999}}>
      <button 
        onClick={() => alert(tokenData)}
        style={{padding: '5px 10px', backgroundColor: '#f0f0f0', border: '1px solid #ccc'}}
      >
        Debug Token
      </button>
    </div>
  );
};

export default DebugToken;