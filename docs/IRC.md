
Common IRC server commands facilitate user interaction and channel management. These commands are typically entered in an IRC client, prefixed with a forward slash (/).
Basic User Commands:

    /NICK <newnickname>: Changes your current nickname.
    /USER <username> <hostname> <servername> :<realname>: Used during connection to register your user details with the server.
    /JOIN <#channelname>: Joins a specific channel.
    /PART <#channelname>: Leaves a specific channel.
    /PRIVMSG <nickname|#channelname> :<message>: Sends a private message to a user or a public message to a channel. 

    /QUERY <nickname> :<message>: Opens a private chat window with a user.
    /MSG <nickname|#channelname> <message>: Similar to PRIVMSG.
    /WHOIS <nickname>: Displays information about a user.
    /AWAY <reason>: Sets an away message, indicating you are not actively present.
    /QUIT :<reason>: Disconnects from the IRC server. 

Channel Management Commands:

    /MODE <#channelname> <modes> <parameters>: Sets or removes channel modes (e.g., +o to give operator status, +b to ban a user, +i for invite-only).
    /KICK <#channelname> <nickname> :<reason>: Removes a user from a channel.
    /TOPIC <#channelname> :<newtopic>: Sets or changes the topic of a channel.
    /INVITE <nickname> <#channelname>: Invites a user to a channel. 

Server Information Commands:

    /LIST: Lists available channels on the network.
    /LUSERS: Displays statistics about users and channels on the network.
    /VERSION: Shows the version of the IRC server.
    /TIME: Displays the local time of the server.
    /MOTD: Displays the Message of the Day from the server. 

Operator Commands (Require IRC Operator privileges):

    /OPER <username> <password>: Identifies as an IRC Operator.
    /KILL <nickname> :<reason>: Disconnects a user from the network.
    /CONNECT <server> <port> <targetserver>: Connects two IRC servers together.
    /DIE <password>: Shuts down the IRC server.
    /REHASH: Reloads the server's configuration file. 